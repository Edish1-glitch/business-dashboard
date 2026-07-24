import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { downloadFromR2 } from "@/lib/r2";
import { readFile } from "fs/promises";
import { Readable } from "stream";
import archiver from "archiver";
import { htmlToPdf } from "@/lib/html-to-pdf";

export const runtime = "nodejs";

/**
 * Fetch ONE invoice's file content at a time. The bulk query deliberately does
 * not select `fileData` (that would pull every base64 blob into memory at once);
 * for DB-stored files we fetch just this row's blob here, on demand.
 */
async function getFileBuffer(meta: {
  id: string;
  fileUrl: string | null;
  filePath: string;
}): Promise<Buffer> {
  if (meta.fileUrl && meta.filePath.startsWith("r2://")) {
    const { buffer } = await downloadFromR2(meta.fileUrl);
    return buffer;
  }
  // Not R2 → either inline base64 in the DB or a local file path.
  const row = await prisma.invoice.findUnique({
    where: { id: meta.id },
    select: { fileData: true },
  });
  if (row?.fileData) return Buffer.from(row.fileData, "base64");
  return await readFile(meta.filePath);
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "יש לבחור לפחות חשבונית אחת" }, { status: 400 });
    }

    // Metadata only — NOT fileData. Files are streamed one at a time below, so a
    // "download all" of any size stays within a bounded memory footprint.
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: ids }, userId: user.id },
      select: { id: true, fileName: true, filePath: true, fileUrl: true, date: true, createdAt: true },
    });

    if (invoices.length === 0) {
      return NextResponse.json({ error: "לא נמצאו חשבוניות" }, { status: 404 });
    }

    const dates = invoices
      .map((inv) => inv.date || inv.createdAt)
      .sort((a, b) => a.getTime() - b.getTime());
    const fmt = (d: Date) => `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
    const folderName = `${fmt(dates[0])}_${fmt(dates[dates.length - 1])}`;
    const zipName = `${folderName}.zip`;

    // Streaming ZIP: each file is fetched, added, flushed to the response, and
    // released — only one file (plus at most one serialized Chromium render) is
    // resident at a time, regardless of how many invoices are selected.
    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.on("error", (err: Error) => {
      console.error("bulk-download zip error:", err);
      archive.abort();
    });

    (async () => {
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
            name = ext > 0 ? `${name.slice(0, ext)}_${count}${name.slice(ext)}` : `${name}_${count}`;
          }
          usedNames.set(invoice.fileName || name, count + 1);

          archive.append(buffer, { name: `${folderName}/${name}` });
        } catch {
          // skip files that can't be read; keep the rest of the archive going
        }
      }
      await archive.finalize();
    })().catch((err: unknown) => {
      console.error("bulk-download stream error:", err);
      archive.abort();
    });

    const encodedZipName = encodeURIComponent(zipName);
    const webStream = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;
    return new Response(webStream, {
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
