import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { readFile } from "fs/promises";
import { downloadFromR2 } from "@/lib/r2";
import { htmlToPdf } from "@/lib/html-to-pdf";

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
    return NextResponse.json({ error: "חשבונית לא נמצאה" }, { status: 404 });
  }

  try {
    let buffer = await getFileBuffer(invoice);
    const isHtml = invoice.fileName.endsWith(".html") || invoice.filePath === "inline-html";
    const isImage = invoice.fileName.match(/\.(jpg|jpeg|png|webp)$/i);

    let contentType: string;
    let fileName = invoice.fileName;

    if (isHtml) {
      const html = buffer.toString("utf-8");
      buffer = await htmlToPdf(html);
      contentType = "application/pdf";
      fileName = fileName.replace(/\.html$/, ".pdf");
      if (!fileName.endsWith(".pdf")) fileName += ".pdf";
    } else if (isImage) {
      contentType = "image/png";
    } else {
      contentType = "application/pdf";
    }

    const encodedName = encodeURIComponent(fileName);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      },
    });
  } catch (err) {
    console.error("Download error for invoice", id, err);
    return NextResponse.json({ error: "שגיאה בהורדת הקובץ" }, { status: 500 });
  }
}
