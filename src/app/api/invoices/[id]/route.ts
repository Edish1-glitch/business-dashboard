import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { deleteFromR2 } from "@/lib/r2";

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

// DELETE invoice
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.userId !== user.id) {
      return NextResponse.json({ error: "חשבונית לא נמצאה" }, { status: 404 });
    }

    // Delete associated expenses first
    await prisma.expense.deleteMany({ where: { invoiceId: id } });

    // Delete file from R2 if stored there
    if (invoice.fileUrl && invoice.filePath.startsWith("r2://")) {
      try {
        await deleteFromR2(invoice.fileUrl);
      } catch { /* file might already be deleted */ }
    }

    // Delete invoice
    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Invoice delete error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת חשבונית" }, { status: 500 });
  }
}
