import { NextRequest, NextResponse } from "next/server";
import { splitPdfToPages } from "@/lib/pdf/split";
import { extractTextFromPdf } from "@/lib/pdf/extract";
import { ocrFromImage } from "@/lib/pdf/ocr-image";
import { extractInvoiceData } from "@/lib/pdf/categorize";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic"];

async function processPage(
  buffer: Buffer,
  fileName: string,
  uploadsDir: string,
  userId: string,
  isImage: boolean
): Promise<{
  id: string;
  fileName: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  creditCardLast4: string | null;
}> {
  // Extract text
  let text = "";
  try {
    text = isImage ? await ocrFromImage(buffer) : await extractTextFromPdf(buffer);
  } catch { /* continue with empty text */ }

  const invoiceData = extractInvoiceData(text);

  // Save file
  const filePath = path.join(uploadsDir, fileName);
  await writeFile(filePath, buffer);

  // Find category
  let categoryId: string | null = null;
  if (invoiceData.category) {
    const category = await prisma.category.findFirst({ where: { name: invoiceData.category } });
    categoryId = category?.id || null;
  }

  // Save invoice with file data in DB
  const invoice = await prisma.invoice.create({
    data: {
      fileName,
      filePath,
      fileData: buffer.toString("base64"),
      vendor: invoiceData.vendor,
      amount: invoiceData.amount,
      date: invoiceData.date,
      source: isImage ? "image-upload" : "pdf-upload",
      status: "pending",
      creditCardLast4: invoiceData.creditCardLast4,
      categoryId,
      userId,
    },
  });

  return {
    id: invoice.id,
    fileName,
    vendor: invoiceData.vendor,
    amount: invoiceData.amount,
    date: invoiceData.date?.toISOString() || null,
    category: invoiceData.category,
    creditCardLast4: invoiceData.creditCardLast4,
  };
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

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      const buffer = Buffer.from(await file.arrayBuffer());
      const isImage = IMAGE_EXTENSIONS.includes(ext);
      const isPdf = ext === ".pdf";

      if (!isImage && !isPdf) {
        continue; // Skip unsupported files
      }

      if (isPdf) {
        // Split PDF into pages, process each
        const pages = await splitPdfToPages(buffer);
        for (let i = 0; i < pages.length; i++) {
          const result = await processPage(
            pages[i],
            `${path.basename(file.name, ext)}_page${i + 1}.pdf`,
            uploadsDir,
            user.id,
            false
          );
          results.push({ ...result, page: i + 1, sourceFile: file.name });
        }
      } else {
        // Single image = single invoice
        const result = await processPage(
          buffer,
          file.name,
          uploadsDir,
          user.id,
          true
        );
        results.push({ ...result, page: 1, sourceFile: file.name });
      }
    }

    return NextResponse.json({
      success: true,
      totalInvoices: results.length,
      invoices: results,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "שגיאה בעיבוד הקבצים" }, { status: 500 });
  }
}
