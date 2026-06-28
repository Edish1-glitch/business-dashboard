import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { downloadFromR2 } from "@/lib/r2";
import { readFile } from "fs/promises";
import JSZip from "jszip";
import { htmlToPdf } from "@/lib/html-to-pdf";

async function getFileBuffer(invoice: { fileData: string | null; fileUrl: string | null; filePath: string }): Promise<Buffer> {
  if (invoice.fileUrl && invoice.filePath.startsWith("r2://")) {
    const { buffer } = await downloadFromR2(invoice.fileUrl);
    return buffer;
  }
  if (invoice.fileData) {
    return Buffer.from(invoice.fileData, "base64");
  }
  return await readFile(invoice.filePath);
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "יש לבחור לפחות חשבונית אחת" }, { status: 400 });
    }

    const invoices = await prisma.invoice.findMany({
      where: { id: { in: ids }, userId: user.id },
    });

    if (invoices.length === 0) {
      return NextResponse.json({ error: "לא נמצאו חשבוניות" }, { status: 404 });
    }

    const dates = invoices
      .map((inv) => inv.date || inv.createdAt)
      .sort((a, b) => a.getTime() - b.getTime());
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const fmt = (d: Date) => `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
    const folderName = `${fmt(minDate)}_${fmt(maxDate)}`;

    const zip = new JSZip();
    const usedNames = new Map<string, number>();

    for (const invoice of invoices) {
      try {
        let buffer = await getFileBuffer(invoice);
        let name = invoice.fileName || `invoice-${invoice.id}.pdf`;

        const isHtml = name.endsWith(".html") || invoice.filePath === "inline-html";
        if (isHtml) {
          buffer = await htmlToPdf(buffer.toString("utf-8"));
          name = name.replace(/\.html$/, ".pdf");
          if (!name.endsWith(".pdf")) name += ".pdf";
        }

        const count = usedNames.get(name) || 0;
        if (count > 0) {
          const ext = name.lastIndexOf(".");
          name = ext > 0
            ? `${name.slice(0, ext)}_${count}${name.slice(ext)}`
            : `${name}_${count}`;
        }
        usedNames.set(invoice.fileName || name, count + 1);

        zip.file(`${folderName}/${name}`, buffer);
      } catch {
        // skip files that can't be read
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 5 } });
    const zipName = `${folderName}.zip`;

    const encodedZipName = encodeURIComponent(zipName);
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodedZipName}"; filename*=UTF-8''${encodedZipName}`,
      },
    });
  } catch (error) {
    console.error("Bulk download error:", error);
    return NextResponse.json({ error: "שגיאה בהורדה" }, { status: 500 });
  }
}
