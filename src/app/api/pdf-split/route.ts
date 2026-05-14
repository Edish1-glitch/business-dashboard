import { NextRequest, NextResponse } from "next/server";
import { splitPdfToPages } from "@/lib/pdf/split";
import { extractTextFromPdf } from "@/lib/pdf/extract";
import { extractInvoiceData } from "@/lib/pdf/categorize";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "יש להעלות קובץ PDF" },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const pages = await splitPdfToPages(pdfBuffer);

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "הקובץ ריק או לא ניתן לפיצול" },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "uploads", Date.now().toString());
    await mkdir(uploadsDir, { recursive: true });

    const results = [];

    for (let i = 0; i < pages.length; i++) {
      const pageBuffer = pages[i];
      let text = "";
      try {
        text = await extractTextFromPdf(pageBuffer);
      } catch {
        // Continue with empty text
      }

      const invoiceData = extractInvoiceData(text);
      const fileName = `invoice_${i + 1}.pdf`;
      const filePath = path.join(uploadsDir, fileName);
      await writeFile(filePath, pageBuffer);

      let categoryId: string | null = null;
      if (invoiceData.category) {
        const category = await prisma.category.findFirst({
          where: { name: invoiceData.category },
        });
        categoryId = category?.id || null;
      }

      const invoice = await prisma.invoice.create({
        data: {
          fileName,
          filePath,
          vendor: invoiceData.vendor,
          amount: invoiceData.amount,
          date: invoiceData.date,
          source: "pdf-upload",
          status: "pending",
          creditCardLast4: invoiceData.creditCardLast4,
          categoryId,
          userId: user.id,
        },
        include: { category: true },
      });

      results.push({
        id: invoice.id,
        page: i + 1,
        fileName,
        vendor: invoiceData.vendor,
        amount: invoiceData.amount,
        date: invoiceData.date?.toISOString() || null,
        category: invoiceData.category,
        creditCardLast4: invoiceData.creditCardLast4,
        textPreview: text.substring(0, 200),
      });
    }

    return NextResponse.json({
      success: true,
      totalPages: pages.length,
      invoices: results,
    });
  } catch (error) {
    console.error("PDF split error:", error);
    return NextResponse.json(
      { error: "שגיאה בעיבוד הקובץ" },
      { status: 500 }
    );
  }
}
