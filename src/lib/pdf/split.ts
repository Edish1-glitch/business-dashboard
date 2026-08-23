import { PDFDocument } from "pdf-lib";

// Fixed timestamp used for every split page so the output is byte-deterministic.
// pdf-lib stamps CreationDate/ModDate with `new Date()` at PDFDocument.create(),
// so re-splitting the *same* source page would otherwise produce different bytes
// every run → a different sha256 → the fileHash dedup never matches → the
// background cron re-imports the same invoice on every pass (the "flood" bug).
// Pinning both dates to a constant makes save() output stable across runs.
const DETERMINISTIC_DATE = new Date(0);

/**
 * Splits a PDF buffer into individual pages, each as a separate PDF buffer.
 * Output is deterministic: the same source page always yields identical bytes
 * (so its fileHash is stable across syncs — see DETERMINISTIC_DATE above).
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
    newDoc.setCreationDate(DETERMINISTIC_DATE);
    newDoc.setModificationDate(DETERMINISTIC_DATE);
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
