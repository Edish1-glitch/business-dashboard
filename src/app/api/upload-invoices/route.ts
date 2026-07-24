import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { processAndSave, splitPdfToPageBuffers, countPageBuffers } from "@/lib/invoice-processor";
import { R2_LIMITS } from "@/lib/r2";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "יש להעלות לפחות קובץ אחד" }, { status: 400 });
    }

    if (files.length > R2_LIMITS.MAX_FILES_PER_UPLOAD) {
      return NextResponse.json({
        error: `מקסימום ${R2_LIMITS.MAX_FILES_PER_UPLOAD} קבצים בהעלאה אחת`
      }, { status: 400 });
    }

    const { user, error } = await getAuthUser();
    if (error) return error;

    // Safety: check daily upload limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUploads = await prisma.invoice.count({
      where: { userId: user.id, createdAt: { gte: today } },
    });
    if (todayUploads >= R2_LIMITS.MAX_UPLOADS_PER_DAY) {
      return NextResponse.json({
        error: `הגעת למגבלת ההעלאה היומית (${R2_LIMITS.MAX_UPLOADS_PER_DAY} קבצים). נסה שוב מחר.`
      }, { status: 429 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const results = [];
        let processed = 0;

        // Pre-count pages cheaply (one file loaded at a time, released immediately)
        // so we can show an accurate total WITHOUT holding every page of every file.
        let totalPages = 0;
        for (const file of files) {
          const buf = Buffer.from(await file.arrayBuffer());
          totalPages += await countPageBuffers(buf, file.name);
        }

        controller.enqueue(encoder.encode(
          JSON.stringify({ type: "progress", total: totalPages, current: 0, message: `מתחיל עיבוד ${totalPages} חשבוניות...` }) + "\n"
        ));

        // Process ONE file at a time: split -> process its pages -> release before
        // the next file, so at most a single file's page buffers are resident.
        for (const file of files) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const pages = await splitPdfToPageBuffers(buffer, file.name);
          for (const page of pages) {
            processed++;
            controller.enqueue(encoder.encode(
              JSON.stringify({ type: "progress", total: totalPages, current: processed, message: `מעבד חשבונית ${processed} מתוך ${totalPages}...` }) + "\n"
            ));

            try {
              const result = await processAndSave(page.buffer, page.fileName, user.id, page.isImage);
              results.push({ ...result, page: processed, sourceFile: file.name });
            } catch (err) {
              results.push({
                id: null, fileName: page.fileName, vendor: null, amount: null,
                date: null, category: null, creditCardLast4: null,
                duplicate: false, message: err instanceof Error ? err.message : "שגיאה בעיבוד",
                similarWarning: null, page: processed, sourceFile: file.name,
              });
            }
          }
        }

        const duplicates = results.filter(r => r.duplicate).length;
        controller.enqueue(encoder.encode(
          JSON.stringify({
            type: "done", success: true,
            totalInvoices: results.length, duplicatesSkipped: duplicates,
            invoices: results,
          }) + "\n"
        ));

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "שגיאה בעיבוד הקבצים" }, { status: 500 });
  }
}
