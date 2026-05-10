/**
 * Extracts text from a single-page PDF buffer.
 * First tries native text extraction via pdfjs-dist; if empty, falls back to OCR.
 */
export async function extractTextFromPdf(
  pdfBuffer: Buffer
): Promise<string> {
  // Try native text extraction first
  try {
    const text = await extractWithPdfJs(pdfBuffer);
    if (text && text.length > 20) {
      return text;
    }
  } catch {
    // Fall through to OCR
  }

  // Fall back to OCR
  return ocrFromPdf(pdfBuffer);
}

async function extractWithPdfJs(pdfBuffer: Buffer): Promise<string> {
  // pdfjs-dist for Node.js
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const data = new Uint8Array(pdfBuffer);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

  let fullText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText.trim();
}

async function ocrFromPdf(pdfBuffer: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const sharp = (await import("sharp")).default;

  // Convert PDF to image for OCR
  let imageBuffer: Buffer;
  try {
    imageBuffer = await sharp(pdfBuffer, { density: 300 })
      .png()
      .toBuffer();
  } catch {
    return "";
  }

  const worker = await createWorker("heb+eng");
  const {
    data: { text: ocrText },
  } = await worker.recognize(imageBuffer);
  await worker.terminate();

  return ocrText?.trim() || "";
}
