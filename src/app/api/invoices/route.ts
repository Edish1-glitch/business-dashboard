import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const creditCardLast4 = searchParams.get("creditCardLast4");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {
      userId: user.id,
    };

    if (status) where.status = status;

    if (categoryId) where.categoryId = categoryId;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }
    if (creditCardLast4) {
      const expenses = await prisma.expense.findMany({
        where: {
          userId: user.id,
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
  } catch (error) {
    console.error("Invoices API error:", error);
    return NextResponse.json({ invoices: [], error: "שגיאה בטעינת חשבוניות" }, { status: 500 });
  }
}
