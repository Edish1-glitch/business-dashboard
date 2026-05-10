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
