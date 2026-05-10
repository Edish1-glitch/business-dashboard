import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdtemp } from "fs/promises";
import { rm } from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

/**
 * Extracts text from a single-page PDF buffer.
 * Tries native text first, falls back to CLI-based OCR (fast).
 */
export async function extractTextFromPdf(
  pdfBuffer: Buffer
): Promise<string> {
  // Try native text extraction first (instant)
  try {
    const text = await extractWithPdfJs(pdfBuffer);
    if (text && text.length > 20) {
      return text;
    }
  } catch {
    // Fall through to OCR
  }

  // OCR via tesseract CLI + pdftoppm (fast, local)
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
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "findash-ocr-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const imgPrefix = path.join(tmpDir, "page");
  const imgPath = path.join(tmpDir, "page-1.png");

  try {
    await writeFile(pdfPath, pdfBuffer);

    // PDF → PNG via pdftoppm (poppler) - fast
    await execFileAsync("pdftoppm", ["-png", "-r", "300", "-singlefile", pdfPath, imgPrefix]);

    // PNG → text via tesseract CLI - run from tmpDir to avoid path issues
    const { stdout } = await execFileAsync("tesseract", ["page.png", "stdout", "-l", "heb+eng"], { cwd: tmpDir });

    return stdout?.trim() || "";
  } catch (error) {
    console.error("OCR error:", error);
    return "";
  } finally {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
