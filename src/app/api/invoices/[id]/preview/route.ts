import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { downloadFromR2 } from "@/lib/r2";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdtemp, rm } from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

/**
 * Get file buffer from R2, DB (base64), or local filesystem.
 */
async function getFileBuffer(invoice: { fileData: string | null; fileUrl: string | null; filePath: string }): Promise<Buffer> {
  // R2 storage
  if (invoice.fileUrl && invoice.filePath.startsWith("r2://")) {
    const { buffer } = await downloadFromR2(invoice.fileUrl);
    return buffer;
  }
  // DB base64
  if (invoice.fileData) {
    return Buffer.from(invoice.fileData, "base64");
  }
  // Local filesystem fallback
  return await readFile(invoice.filePath);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  try {
    const fileBuffer = await getFileBuffer(invoice);

    // If it's an image, return directly
    const isImage = invoice.fileName.match(/\.(jpg|jpeg|png|webp)$/i);
    if (isImage) {
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Convert PDF to PNG using pdftoppm
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "findash-preview-"));
    const pdfPath = path.join(tmpDir, "input.pdf");
    const imgPrefix = path.join(tmpDir, "page");

    await writeFile(pdfPath, fileBuffer);
    await execFileAsync("pdftoppm", ["-png", "-r", "200", "-singlefile", pdfPath, imgPrefix]);

    const imgBuffer = await readFile(path.join(tmpDir, "page.png"));
    await rm(tmpDir, { recursive: true, force: true });

    return new NextResponse(new Uint8Array(imgBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "שגיאה ביצירת תצוגה מקדימה" }, { status: 500 });
  }
}
