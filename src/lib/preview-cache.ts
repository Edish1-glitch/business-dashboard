import { readFile, writeFile, mkdir, rm, mkdtemp } from "fs/promises";
import { existsSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import { downloadFromR2, uploadToR2Key, isR2Configured } from "@/lib/r2";

const execFileAsync = promisify(execFile);

/**
 * Cached invoice previews.
 *
 * The expensive case is PDF → PNG (`pdftoppm`). Rendering it on *every* preview
 * request melts the 512MB / 0.1-CPU instance (many thumbnails load at once → the
 * requests time out → broken images). So we render each PDF's first page to PNG
 * exactly once and store it statically, keyed by invoice id:
 *   - R2 (prod): object `previews/<id>.png` — the real cache.
 *   - disk (dev, no R2): <tmp>/findash-preview-cache/<id>.png (per-container).
 * Subsequent requests download/serve the cached PNG instantly, no render.
 *
 * HTML and image invoices are cheap (no render) and handled directly by the
 * route, not here.
 */

export interface PreviewSource {
  id: string;
  fileData: string | null;
  fileUrl: string | null;
  filePath: string;
}

// pdftoppm is CPU + memory heavy; never run two at once on the tight instance.
let renderChain: Promise<unknown> = Promise.resolve();
function withRenderLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = renderChain.then(fn, fn);
  renderChain = run.catch(() => {});
  return run;
}

const r2Key = (id: string) => `previews/${id}.png`;
const diskPath = (id: string) => path.join(os.tmpdir(), "findash-preview-cache", `${id}.png`);

async function getSourceBuffer(inv: PreviewSource): Promise<Buffer> {
  if (inv.fileUrl && inv.filePath.startsWith("r2://")) {
    const { buffer } = await downloadFromR2(inv.fileUrl);
    return buffer;
  }
  if (inv.fileData) return Buffer.from(inv.fileData, "base64");
  return await readFile(inv.filePath);
}

async function renderPdfToPng(pdf: Buffer): Promise<Buffer> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "findash-preview-"));
  try {
    const pdfPath = path.join(tmpDir, "input.pdf");
    const imgPrefix = path.join(tmpDir, "page");
    await writeFile(pdfPath, pdf);
    await execFileAsync("pdftoppm", ["-png", "-r", "150", "-singlefile", pdfPath, imgPrefix]);
    return await readFile(path.join(tmpDir, "page.png"));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function readCache(id: string): Promise<Buffer | null> {
  if (isR2Configured()) {
    try {
      const { buffer } = await downloadFromR2(r2Key(id));
      return buffer;
    } catch {
      return null;
    }
  }
  const p = diskPath(id);
  if (existsSync(p)) {
    try { return await readFile(p); } catch { return null; }
  }
  return null;
}

async function writeCache(id: string, png: Buffer): Promise<void> {
  try {
    if (isR2Configured()) {
      await uploadToR2Key(r2Key(id), png, "image/png");
    } else {
      const p = diskPath(id);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, png);
    }
  } catch {
    // Caching is best-effort — a failed write just means we render again later.
  }
}

/**
 * Cached first-page PNG for a PDF invoice. Renders once (serialized), then
 * serves from R2/disk on every later call.
 */
export async function getPdfPreviewPng(inv: PreviewSource): Promise<Buffer> {
  const cached = await readCache(inv.id);
  if (cached) return cached;

  return withRenderLock(async () => {
    // Re-check inside the lock: a concurrent request may have just cached it.
    const again = await readCache(inv.id);
    if (again) return again;

    const png = await renderPdfToPng(await getSourceBuffer(inv));
    await writeCache(inv.id, png);
    return png;
  });
}
