import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { splitPdfToPages } from "@/lib/pdf/split";
import { extractTextFromPdf } from "@/lib/pdf/extract";
import { ocrFromImage } from "@/lib/pdf/ocr-image";
import { extractInvoiceData } from "@/lib/pdf/categorize";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic"];

// Phase 1: Save invoice immediately (no OCR - fast)
async function saveInvoice(
  buffer: Buffer,
  fileName: string,
  uploadsDir: string,
  userId: string,
  isImage: boolean
) {
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  // Check for exact duplicate
  const exactDup = await prisma.invoice.findFirst({
    where: { fileHash, userId },
  });
  if (exactDup) {
    return {
      id: exactDup.id,
      fileName,
      vendor: exactDup.vendor,
      amount: exactDup.amount,
      date: exactDup.date?.toISOString() || null,
      category: null,
      creditCardLast4: exactDup.creditCardLast4,
      duplicate: true,
      duplicateType: "exact" as const,
      message: "קובץ זהה כבר הועלה",
      similarWarning: null,
      processing: false,
    };
  }

  // Save file
  const filePath = path.join(uploadsDir, fileName);
  await writeFile(filePath, buffer);

  // Save invoice without OCR data (will be filled later)
  const invoice = await prisma.invoice.create({
    data: {
      fileName,
      filePath,
      fileHash,
      fileData: buffer.length < 500000 ? buffer.toString("base64") : null,
      source: isImage ? "image-upload" : "pdf-upload",
      status: "pending",
      userId,
    },
  });

  return {
    id: invoice.id,
    fileName,
    vendor: null,
    amount: null,
    date: null,
    category: null,
    creditCardLast4: null,
    duplicate: false,
    duplicateType: null,
    message: null,
    similarWarning: null,
    processing: true, // OCR will happen in background
  };
}

// Phase 2: Process OCR in background (slow)
async function processOCR(invoiceId: string, buffer: Buffer, isImage: boolean, userId: string) {
  try {
    const text = isImage ? await ocrFromImage(buffer) : await extractTextFromPdf(buffer);
    const invoiceData = extractInvoiceData(text);

    let categoryId: string | null = null;
    if (invoiceData.category) {
      const category = await prisma.category.findFirst({ where: { name: invoiceData.category } });
      categoryId = category?.id || null;
    }

    // Check for similar invoice
    let similarWarning: string | null = null;
    if (invoiceData.vendor && invoiceData.amount && invoiceData.date) {
      const similar = await prisma.invoice.findFirst({
        where: {
          userId,
          vendor: invoiceData.vendor,
          amount: invoiceData.amount,
          date: invoiceData.date,
          id: { not: invoiceId },
        },
      });
      if (similar) similarWarning = "חשבונית דומה כבר קיימת";
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        vendor: invoiceData.vendor,
        amount: invoiceData.amount,
        date: invoiceData.date,
        creditCardLast4: invoiceData.creditCardLast4,
        categoryId,
      },
    });
  } catch (e) {
    console.error("OCR processing error:", e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "יש להעלות לפחות קובץ אחד" }, { status: 400 });
    }

    const { user, error } = await getAuthUser();
    if (error) return error;

    const uploadsDir = path.join(process.cwd(), "uploads", Date.now().toString());
    await mkdir(uploadsDir, { recursive: true });

    const results = [];
    const ocrTasks: { invoiceId: string; buffer: Buffer; isImage: boolean }[] = [];

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());
      const isImage = IMAGE_EXTENSIONS.includes(ext);
      const isPdf = ext === ".pdf";

      if (!isImage && !isPdf) continue;

      if (isPdf) {
        const pages = await splitPdfToPages(buffer);
        for (let i = 0; i < pages.length; i++) {
          const result = await saveInvoice(
            pages[i],
            `${path.basename(file.name, ext)}_page${i + 1}.pdf`,
            uploadsDir,
            user.id,
            false
          );
          results.push({ ...result, page: i + 1, sourceFile: file.name });
          if (!result.duplicate && result.processing) {
            ocrTasks.push({ invoiceId: result.id, buffer: pages[i], isImage: false });
          }
        }
      } else {
        const result = await saveInvoice(buffer, file.name, uploadsDir, user.id, true);
        results.push({ ...result, page: 1, sourceFile: file.name });
        if (!result.duplicate && result.processing) {
          ocrTasks.push({ invoiceId: result.id, buffer, isImage: true });
        }
      }
    }

    // Start OCR processing in background (don't await)
    if (ocrTasks.length > 0) {
      Promise.all(
        ocrTasks.map((t) => processOCR(t.invoiceId, t.buffer, t.isImage, user.id))
      ).catch(console.error);
    }

    const duplicates = results.filter((r) => r.duplicate).length;

    return NextResponse.json({
      success: true,
      totalInvoices: results.length,
      duplicatesSkipped: duplicates,
      invoices: results,
      ocrProcessing: ocrTasks.length > 0,
      message: ocrTasks.length > 0
        ? `${results.length - duplicates} חשבוניות נשמרו. OCR מעבד ברקע...`
        : duplicates > 0
          ? `${duplicates} חשבוניות כפולות דולגו`
          : undefined,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "שגיאה בעיבוד הקבצים" }, { status: 500 });
  }
}
