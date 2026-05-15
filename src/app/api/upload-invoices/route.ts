import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { splitPdfToPages } from "@/lib/pdf/split";
import { extractTextFromPdf } from "@/lib/pdf/extract";
import { ocrFromImage } from "@/lib/pdf/ocr-image";
import { extractInvoiceData } from "@/lib/pdf/categorize";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { uploadToR2, isR2Configured, R2_LIMITS } from "@/lib/r2";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic"];

async function processAndSave(
  buffer: Buffer,
  fileName: string,
  uploadsDir: string,
  userId: string,
  isImage: boolean,
  useR2: boolean
) {
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  // Check exact duplicate
  const exactDup = await prisma.invoice.findFirst({ where: { fileHash, userId } });
  if (exactDup) {
    return {
      id: exactDup.id, fileName, vendor: exactDup.vendor, amount: exactDup.amount,
      date: exactDup.date?.toISOString() || null, category: null,
      creditCardLast4: exactDup.creditCardLast4,
      duplicate: true, message: "קובץ זהה כבר הועלה", similarWarning: null,
    };
  }

  // Safety: check file size
  if (buffer.length > R2_LIMITS.MAX_FILE_SIZE) {
    throw new Error(`קובץ גדול מדי (${(buffer.length / 1024 / 1024).toFixed(1)}MB). מקסימום ${R2_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // OCR + extract data
  let text = "";
  try {
    text = isImage ? await ocrFromImage(buffer) : await extractTextFromPdf(buffer);
  } catch { /* continue */ }
  const invoiceData = extractInvoiceData(text);

  // Save file - R2 or local+DB fallback
  let filePath = "";
  let fileUrl: string | null = null;
  let fileData: string | null = null;
  const contentType = isImage
    ? `image/${path.extname(fileName).slice(1).replace("jpg", "jpeg")}`
    : "application/pdf";

  if (useR2) {
    const r2Result = await uploadToR2(buffer, fileName, userId, contentType);
    fileUrl = r2Result.key; // store R2 key in fileUrl field
    filePath = `r2://${r2Result.key}`;
  } else {
    // Fallback: save locally + base64 in DB
    filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, buffer);
    fileData = buffer.toString("base64");
  }

  // Find category
  let categoryId: string | null = null;
  if (invoiceData.category) {
    const cat = await prisma.category.findFirst({ where: { name: invoiceData.category } });
    categoryId = cat?.id || null;
  }

  // Check similar
  let similarWarning: string | null = null;
  if (invoiceData.vendor && invoiceData.amount && invoiceData.date) {
    const similar = await prisma.invoice.findFirst({
      where: { userId, vendor: invoiceData.vendor, amount: invoiceData.amount, date: invoiceData.date },
    });
    if (similar) similarWarning = "חשבונית דומה כבר קיימת";
  }

  // Save to DB
  const invoice = await prisma.invoice.create({
    data: {
      fileName, filePath, fileHash, fileUrl, fileData,
      vendor: invoiceData.vendor,
      amount: invoiceData.amount,
      currency: invoiceData.currency || "ILS",
      date: invoiceData.date,
      source: isImage ? "image-upload" : "pdf-upload",
      status: "pending",
      creditCardLast4: invoiceData.creditCardLast4,
      categoryId, userId,
    },
  });

  return {
    id: invoice.id, fileName,
    vendor: invoiceData.vendor,
    amount: invoiceData.amount,
    date: invoiceData.date?.toISOString() || null,
    category: invoiceData.category,
    creditCardLast4: invoiceData.creditCardLast4,
    duplicate: false, message: null, similarWarning,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "יש להעלות לפחות קובץ אחד" }, { status: 400 });
    }

    // Safety: max files per upload
    if (files.length > R2_LIMITS.MAX_FILES_PER_UPLOAD) {
      return NextResponse.json({
        error: `מקסימום ${R2_LIMITS.MAX_FILES_PER_UPLOAD} קבצים בהעלאה אחת`
      }, { status: 400 });
    }

    const { user, error } = await getAuthUser();
    if (error) return error;

    // Safety: check daily upload limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUploads = await prisma.invoice.count({
      where: { userId: user.id, createdAt: { gte: today } },
    });
    if (todayUploads >= R2_LIMITS.MAX_UPLOADS_PER_DAY) {
      return NextResponse.json({
        error: `הגעת למגבלת ההעלאה היומית (${R2_LIMITS.MAX_UPLOADS_PER_DAY} קבצים). נסה שוב מחר.`
      }, { status: 429 });
    }

    const useR2 = isR2Configured();
    const uploadsDir = path.join(process.cwd(), "uploads", Date.now().toString());
    if (!useR2) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Use streaming to send progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const results = [];
        let totalPages = 0;
        let processed = 0;

        // First pass: count total pages
        const pageBuffers: { buffer: Buffer; fileName: string; isImage: boolean; sourceFile: string }[] = [];
        for (const file of files) {
          const ext = path.extname(file.name).toLowerCase();
          const buffer = Buffer.from(await file.arrayBuffer());
          const isImage = IMAGE_EXTENSIONS.includes(ext);
          const isPdf = ext === ".pdf";
          if (!isImage && !isPdf) continue;

          if (isPdf) {
            const pages = await splitPdfToPages(buffer);
            for (let i = 0; i < pages.length; i++) {
              pageBuffers.push({
                buffer: pages[i],
                fileName: `${path.basename(file.name, ext)}_page${i + 1}.pdf`,
                isImage: false,
                sourceFile: file.name,
              });
            }
          } else {
            pageBuffers.push({ buffer, fileName: file.name, isImage: true, sourceFile: file.name });
          }
        }

        totalPages = pageBuffers.length;

        // Send total count
        controller.enqueue(encoder.encode(
          JSON.stringify({ type: "progress", total: totalPages, current: 0, message: `מתחיל עיבוד ${totalPages} חשבוניות...` }) + "\n"
        ));

        // Process each page with progress
        for (const page of pageBuffers) {
          processed++;
          controller.enqueue(encoder.encode(
            JSON.stringify({ type: "progress", total: totalPages, current: processed, message: `מעבד חשבונית ${processed} מתוך ${totalPages}...` }) + "\n"
          ));

          try {
            const result = await processAndSave(page.buffer, page.fileName, uploadsDir, user.id, page.isImage, useR2);
            results.push({ ...result, page: processed, sourceFile: page.sourceFile });
          } catch (err) {
            results.push({
              id: null, fileName: page.fileName, vendor: null, amount: null,
              date: null, category: null, creditCardLast4: null,
              duplicate: false, message: err instanceof Error ? err.message : "שגיאה בעיבוד",
              similarWarning: null, page: processed, sourceFile: page.sourceFile,
            });
          }
        }

        // Send final result
        const duplicates = results.filter(r => r.duplicate).length;
        controller.enqueue(encoder.encode(
          JSON.stringify({
            type: "done",
            success: true,
            totalInvoices: results.length,
            duplicatesSkipped: duplicates,
            invoices: results,
          }) + "\n"
        ));

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "שגיאה בעיבוד הקבצים" }, { status: 500 });
  }
}
