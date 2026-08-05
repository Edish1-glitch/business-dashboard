import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Approve all pending invoices
export async function POST() {
  const { user, error } = await getAuthUser();
  if (error) return error;

  const pendingInvoices = await prisma.invoice.findMany({
    where: { userId: user.id, status: "pending", deletedAt: null },
    // Only the fields needed to approve + create the expense — not fileData.
    select: {
      id: true, amount: true, vendor: true, fileName: true,
      date: true, categoryId: true, creditCardLast4: true,
    },
  });

  let approved = 0;

  for (const invoice of pendingInvoices) {
    // Find credit card
    let creditCardId: string | null = null;
    if (invoice.creditCardLast4) {
      const card = await prisma.creditCard.findFirst({
        where: { userId: user.id, lastFour: invoice.creditCardLast4 },
      });
      creditCardId = card?.id || null;
    }

    // Update status
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "approved" },
    });

    // Create expense
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
          userId: user.id,
        },
      });
    }

    approved++;
  }

  return NextResponse.json({ success: true, approved });
}
