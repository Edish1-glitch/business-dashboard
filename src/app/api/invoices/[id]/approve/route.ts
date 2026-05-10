import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const TEMP_USER_ID = "temp-user-1";

// Approve a single invoice - creates expense record
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "חשבונית לא נמצאה" }, { status: 404 });
  }

  if (invoice.status === "approved") {
    return NextResponse.json({ error: "חשבונית כבר אושרה" }, { status: 400 });
  }

  // Find credit card if last4 exists
  let creditCardId: string | null = null;
  if (invoice.creditCardLast4) {
    const card = await prisma.creditCard.findFirst({
      where: { userId: TEMP_USER_ID, lastFour: invoice.creditCardLast4 },
    });
    creditCardId = card?.id || null;
  }

  // Update invoice status
  await prisma.invoice.update({
    where: { id },
    data: { status: "approved" },
  });

  // Create expense record
  if (invoice.amount) {
    await prisma.expense.create({
      data: {
        amount: invoice.amount,
        description: invoice.vendor || invoice.fileName,
        date: invoice.date || new Date(),
        source: "pdf",
        paymentMethod: invoice.creditCardLast4 ? "credit-card" : "cash",
        categoryId: invoice.categoryId,
        creditCardId,
        invoiceId: invoice.id,
        userId: TEMP_USER_ID,
      },
    });
  }

  return NextResponse.json({ success: true });
}
