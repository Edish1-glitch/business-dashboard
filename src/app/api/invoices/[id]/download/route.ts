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
    return NextResponse.json(
      { error: "חשבונית לא נמצאה" },
      { status: 404 }
    );
  }

  try {
    const fileBuffer = await readFile(invoice.filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "הקובץ לא נמצא" },
      { status: 404 }
    );
  }
}
