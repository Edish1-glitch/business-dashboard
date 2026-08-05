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
    const { vendor, amount, currency, date, categoryId, creditCardLast4, isBusiness } = body;

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
        ...(currency !== undefined && { currency }),
        ...(date !== undefined && { date: date ? new Date(date) : null }),
        ...(categoryId !== undefined && { categoryId }),
        ...(creditCardLast4 !== undefined && { creditCardLast4 }),
        ...(isBusiness !== undefined && { isBusiness: Boolean(isBusiness) }),
      },
      include: { category: true },
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("Invoice update error:", error);
    return NextResponse.json({ error: "שגיאה בעדכון חשבונית" }, { status: 500 });
  }
}

// DELETE invoice — soft delete by default (→ "נמחקו לאחרונה"); ?permanent=true
// hard-deletes (expenses + R2 file). Auto-purge after 14 days handles the rest.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { id } = await params;
    const permanent = new URL(request.url).searchParams.get("permanent") === "true";

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.userId !== user.id) {
      return NextResponse.json({ error: "חשבונית לא נמצאה" }, { status: 404 });
    }

    if (permanent) {
      await prisma.expense.deleteMany({ where: { invoiceId: id } });
      if (invoice.fileUrl && invoice.filePath.startsWith("r2://")) {
        try { await deleteFromR2(invoice.fileUrl); } catch { /* already gone */ }
      }
      await prisma.invoice.delete({ where: { id } });
      return NextResponse.json({ success: true, permanent: true });
    }

    // Soft delete — keeps the row + file so it can be restored.
    await prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Invoice delete error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת חשבונית" }, { status: 500 });
  }
}
