import { NextRequest, NextResponse } from "next/server";
import { splitPdfToPages } from "@/lib/pdf/split";
import { extractTextFromPdf } from "@/lib/pdf/extract";
import { extractInvoiceData } from "@/lib/pdf/categorize";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Temporary user ID until we add auth
const TEMP_USER_ID = "temp-user-1";

async function ensureUser() {
  return prisma.user.upsert({
    where: { email: "user@findash.local" },
    update: {},
    create: {
      id: TEMP_USER_ID,
      email: "user@findash.local",
      name: "משתמש FinDash",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "יש להעלות קובץ PDF" },
        { status: 400 }
      );
    }

    const user = await ensureUser();
    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    // Split PDF into pages
    const pages = await splitPdfToPages(pdfBuffer);

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "הקובץ ריק או לא ניתן לפיצול" },
        { status: 400 }
      );
    }

    // Create upload directory
    const uploadsDir = path.join(process.cwd(), "uploads", Date.now().toString());
    await mkdir(uploadsDir, { recursive: true });

    const results = [];

    for (let i = 0; i < pages.length; i++) {
      const pageBuffer = pages[i];

      // Extract text (native or OCR)
      let text = "";
      try {
        text = await extractTextFromPdf(pageBuffer);
      } catch {
        // Continue with empty text if extraction fails
      }

      // Extract structured data
      const invoiceData = extractInvoiceData(text);

      // Save individual PDF
      const fileName = `invoice_${i + 1}.pdf`;
      const filePath = path.join(uploadsDir, fileName);
      await writeFile(filePath, pageBuffer);

      // Find or match credit card
      let creditCardId: string | null = null;
      if (invoiceData.creditCardLast4) {
        const card = await prisma.creditCard.findFirst({
          where: {
            userId: user.id,
            lastFour: invoiceData.creditCardLast4,
          },
        });
        creditCardId = card?.id || null;
      }

      // Find category
      let categoryId: string | null = null;
      if (invoiceData.category) {
        const category = await prisma.category.findFirst({
          where: { name: invoiceData.category },
        });
        categoryId = category?.id || null;
      }

      // Save invoice to DB with "pending" status (not approved yet)
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
        include: {
          category: true,
        },
      });
      // NOTE: Expense is NOT created here - only after user approves the invoice

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
