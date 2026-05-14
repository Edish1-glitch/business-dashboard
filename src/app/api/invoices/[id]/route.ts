import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// UPDATE invoice (edit before approval)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { vendor, amount, date, categoryId, creditCardLast4 } = body;

    // Verify invoice belongs to user
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "חשבונית לא נמצאה" }, { status: 404 });
    }

    // Validate amount if provided
    if (amount !== undefined && amount !== null) {
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: "סכום לא תקין" }, { status: 400 });
      }
    }

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
  } catch (error) {
    console.error("Invoice update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון חשבונית" }, { status: 500 });
  }
}
