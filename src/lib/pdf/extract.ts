import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

/**
 * Extracts text from a single-page PDF buffer.
 * First tries native text extraction via pdfjs-dist; if empty, falls back to OCR via pdftoppm + tesseract.
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

  // Fall back to OCR via poppler + tesseract
  return ocrFromPdf(pdfBuffer);
}

async function extractWithPdfJs(pdfBuffer: Buffer): Promise<string> {
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
  // Create temp directory for processing
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "findash-ocr-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const imgPrefix = path.join(tmpDir, "page");

  try {
    // Write PDF to temp file
    await writeFile(pdfPath, pdfBuffer);

    // Convert PDF to PNG using pdftoppm (poppler)
    await execFileAsync("pdftoppm", [
      "-png",
      "-r", "300",
      pdfPath,
      imgPrefix,
    ]);

    // Read the generated image (single page = page-1.png)
    const imgPath = path.join(tmpDir, "page-1.png");
    const imageBuffer = await readFile(imgPath);

    // Run OCR with tesseract.js
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("heb+eng");
    const { data: { text } } = await worker.recognize(imageBuffer);
    await worker.terminate();

    return text?.trim() || "";
  } catch (error) {
    console.error("OCR error:", error);
    return "";
  } finally {
    // Cleanup temp files
    try {
      const { rm } = await import("fs/promises");
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
