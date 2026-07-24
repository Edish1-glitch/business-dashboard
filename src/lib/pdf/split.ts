import { PDFDocument } from "pdf-lib";

/**
 * Splits a PDF buffer into individual pages, each as a separate PDF buffer.
 */
export async function splitPdfToPages(
  pdfBuffer: Buffer
): Promise<Buffer[]> {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = srcDoc.getPageCount();
  const pages: Buffer[] = [];

  for (let i = 0; i < pageCount; i++) {
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
    newDoc.addPage(copiedPage);
    const bytes = await newDoc.save();
    pages.push(Buffer.from(bytes));
  }

  return pages;
}

/**
 * Count the pages of a PDF without materializing any per-page buffers.
 * Lets callers show an accurate total up front while still splitting +
 * processing one file at a time (bounded memory).
 */
export async function countPdfPages(pdfBuffer: Buffer): Promise<number> {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  return srcDoc.getPageCount();
}
