import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { readFile } from "fs/promises";
import { downloadFromR2 } from "@/lib/r2";
import { getPdfPreviewPng } from "@/lib/preview-cache";

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
  const { user, error } = await getAuthUser();
  if (error) return error;
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  try {
    // Inline HTML email — return as HTML for iframe rendering (cheap, no render)
    if (invoice.filePath === "inline-html" || invoice.fileName.endsWith(".html")) {
      const fileBuffer = await getFileBuffer(invoice);
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Already an image — return directly (cheap, no render)
    const isImage = invoice.fileName.match(/\.(jpg|jpeg|png|webp)$/i);
    if (isImage) {
      const fileBuffer = await getFileBuffer(invoice);
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // PDF — render to PNG once, then serve the cached copy on every later request.
    const png = await getPdfPreviewPng(invoice);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Immutable: a given invoice's rendered page never changes.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "שגיאה ביצירת תצוגה מקדימה" }, { status: 500 });
  }
}
