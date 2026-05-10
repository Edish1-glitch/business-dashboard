import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const TEMP_USER_ID = "temp-user-1";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");
  const creditCardLast4 = searchParams.get("creditCardLast4");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {
    userId: TEMP_USER_ID,
  };

  if (status) where.status = status;

  if (categoryId) where.categoryId = categoryId;
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, unknown>).gte = new Date(from);
    if (to) (where.date as Record<string, unknown>).lte = new Date(to);
  }
  if (creditCardLast4) {
    // Find invoices linked to expenses with this credit card
    const expenses = await prisma.expense.findMany({
      where: {
        userId: TEMP_USER_ID,
        creditCard: { lastFour: creditCardLast4 },
      },
      select: { invoiceId: true },
    });
    const invoiceIds = expenses
      .map((e) => e.invoiceId)
      .filter((id): id is string => id !== null);
    where.id = { in: invoiceIds };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invoices });
}
