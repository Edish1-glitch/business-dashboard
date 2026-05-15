import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { downloadFromR2 } from "@/lib/r2";

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
    return NextResponse.json({ error: "חשבונית לא נמצאה" }, { status: 404 });
  }

  try {
    const buffer = await getFileBuffer(invoice);
    const isImage = invoice.fileName.match(/\.(jpg|jpeg|png|webp)$/i);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": isImage ? "image/png" : "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }
}
