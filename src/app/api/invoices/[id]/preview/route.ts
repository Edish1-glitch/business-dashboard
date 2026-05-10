import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFile } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdtemp, rm } from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

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
    const pdfBuffer = await readFile(invoice.filePath);

    // Convert PDF to PNG using pdftoppm
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "findash-preview-"));
    const pdfPath = path.join(tmpDir, "input.pdf");
    const imgPrefix = path.join(tmpDir, "page");

    await writeFile(pdfPath, pdfBuffer);
    await execFileAsync("pdftoppm", ["-png", "-r", "200", "-singlefile", pdfPath, imgPrefix]);

    const imgBuffer = await readFile(path.join(tmpDir, "page.png"));
    await rm(tmpDir, { recursive: true, force: true });

    return new NextResponse(imgBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "שגיאה ביצירת תצוגה מקדימה" }, { status: 500 });
  }
}
