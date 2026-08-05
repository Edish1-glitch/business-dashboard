import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Bulk actions: approve or delete multiple invoices
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { action, ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "יש לבחור לפחות חשבונית אחת" }, { status: 400 });
    }

    // Verify all invoices belong to user. Select only what approve/delete use —
    // not the fileData blob.
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: ids }, userId: user.id },
      select: {
        id: true, status: true, amount: true, vendor: true, fileName: true,
        date: true, categoryId: true, creditCardLast4: true, fileUrl: true, filePath: true,
      },
    });

    if (invoices.length === 0) {
      return NextResponse.json({ error: "לא נמצאו חשבוניות" }, { status: 404 });
    }

    if (action === "approve") {
      let approved = 0;
      for (const invoice of invoices) {
        if (invoice.status !== "pending") continue;

        let creditCardId: string | null = null;
        if (invoice.creditCardLast4) {
          const card = await prisma.creditCard.findFirst({
            where: { userId: user.id, lastFour: invoice.creditCardLast4 },
          });
          creditCardId = card?.id || null;
        }

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "approved" },
        });

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
      return NextResponse.json({ success: true, action: "approve", count: approved });
    }

    if (action === "delete") {
      // Soft delete → "נמחקו לאחרונה" (restorable; auto-purged after 14 days).
      await prisma.invoice.updateMany({
        where: { id: { in: invoices.map((i) => i.id) } },
        data: { deletedAt: new Date() },
      });
      return NextResponse.json({ success: true, action: "delete", count: invoices.length });
    }

    return NextResponse.json({ error: "פעולה לא מוכרת" }, { status: 400 });
  } catch (error) {
    console.error("Bulk action error:", error);
    return NextResponse.json({ error: "שגיאה בביצוע הפעולה" }, { status: 500 });
  }
}
