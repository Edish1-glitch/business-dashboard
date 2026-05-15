import { createHash } from "crypto";
import { splitPdfToPages } from "@/lib/pdf/split";
import { extractTextFromPdf } from "@/lib/pdf/extract";
import { ocrFromImage } from "@/lib/pdf/ocr-image";
import { extractInvoiceData } from "@/lib/pdf/categorize";
import { prisma } from "@/lib/db";
import { uploadToR2, isR2Configured, R2_LIMITS } from "@/lib/r2";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export interface ProcessResult {
  id: string | null;
  fileName: string;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  creditCardLast4: string | null;
  duplicate: boolean;
  message: string | null;
  similarWarning: string | null;
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic"];

/**
 * Process a single file buffer: OCR, extract data, save to R2/DB.
 */
export async function processAndSave(
  buffer: Buffer,
  fileName: string,
  userId: string,
  isImage: boolean,
  source: string = isImage ? "image-upload" : "pdf-upload"
): Promise<ProcessResult> {
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
    return {
      id: null, fileName, vendor: null, amount: null, date: null, category: null,
      creditCardLast4: null, duplicate: false,
      message: `קובץ גדול מדי (${(buffer.length / 1024 / 1024).toFixed(1)}MB). מקסימום ${R2_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`,
      similarWarning: null,
    };
  }

  // OCR + extract data
  let text = "";
  try {
    text = isImage ? await ocrFromImage(buffer) : await extractTextFromPdf(buffer);
  } catch { /* continue */ }
  const invoiceData = extractInvoiceData(text);

  // Save file - R2 or local+DB fallback
  const useR2 = isR2Configured();
  let filePath = "";
  let fileUrl: string | null = null;
  let fileData: string | null = null;
  const contentType = isImage
    ? `image/${path.extname(fileName).slice(1).replace("jpg", "jpeg")}`
    : "application/pdf";

  if (useR2) {
    const r2Result = await uploadToR2(buffer, fileName, userId, contentType);
    fileUrl = r2Result.key;
    filePath = `r2://${r2Result.key}`;
  } else {
    const uploadsDir = path.join(process.cwd(), "uploads", Date.now().toString());
    await mkdir(uploadsDir, { recursive: true });
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
      source,
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

/**
 * Split a PDF into pages and return buffers with filenames.
 */
export async function splitPdfToPageBuffers(
  buffer: Buffer,
  originalName: string
): Promise<{ buffer: Buffer; fileName: string; isImage: boolean }[]> {
  const ext = path.extname(originalName).toLowerCase();
  const isImage = IMAGE_EXTENSIONS.includes(ext);

  if (isImage) {
    return [{ buffer, fileName: originalName, isImage: true }];
  }

  const pages = await splitPdfToPages(buffer);
  return pages.map((pageBuffer, i) => ({
    buffer: pageBuffer,
    fileName: `${path.basename(originalName, ext)}_page${i + 1}.pdf`,
    isImage: false,
  }));
}

/**
 * Get current total R2 storage used by checking DB.
 */
export async function getTotalStorageUsed(): Promise<number> {
  const result = await prisma.$queryRawUnsafe<[{ total: bigint | null }]>(
    `SELECT COALESCE(SUM(LENGTH("fileData")), 0) + COALESCE(SUM(CASE WHEN "filePath" LIKE 'r2://%' THEN 100000 ELSE 0 END), 0) as total FROM "Invoice"`
  );
  return Number(result[0]?.total || 0);
}
