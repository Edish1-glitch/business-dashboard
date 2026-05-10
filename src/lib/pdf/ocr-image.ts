import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdtemp, rm } from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

/**
 * OCR text from an image buffer (JPG/PNG/WebP).
 */
export async function ocrFromImage(imageBuffer: Buffer): Promise<string> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "findash-img-ocr-"));
  const imgPath = path.join(tmpDir, "input.png");

  try {
    await writeFile(imgPath, imageBuffer);
    const { stdout } = await execFileAsync("tesseract", ["input.png", "stdout", "-l", "heb+eng"], { cwd: tmpDir });
    return stdout?.trim() || "";
  } catch (error) {
    console.error("Image OCR error:", error);
    return "";
  } finally {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
