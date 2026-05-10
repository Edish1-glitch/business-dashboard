import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// UPDATE invoice (edit before approval)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { vendor, amount, date, categoryId, creditCardLast4 } = body;

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      ...(vendor !== undefined && { vendor }),
      ...(amount !== undefined && { amount: amount ? parseFloat(amount) : null }),
      ...(date !== undefined && { date: date ? new Date(date) : null }),
      ...(categoryId !== undefined && { categoryId }),
      ...(creditCardLast4 !== undefined && { creditCardLast4 }),
    },
    include: { category: true },
  });

  return NextResponse.json({ invoice });
}
