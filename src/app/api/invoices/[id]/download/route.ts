import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    return NextResponse.json({ error: "חשבונית לא נמצאה" }, { status: 404 });
  }

  // Try DB first (base64), then filesystem fallback
  if (invoice.fileData) {
    const buffer = Buffer.from(invoice.fileData, "base64");
    const isImage = invoice.fileName.match(/\.(jpg|jpeg|png|webp)$/i);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": isImage ? "image/png" : "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.fileName}"`,
      },
    });
  }

  // Fallback to filesystem
  try {
    const fileBuffer = await readFile(invoice.filePath);
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }
}
