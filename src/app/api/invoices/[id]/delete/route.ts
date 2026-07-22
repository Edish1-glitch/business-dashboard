import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Delete invoice and associated expenses
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await getAuthUser();
  if (error) return error;
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: "חשבונית לא נמצאה" }, { status: 404 });
  }

  // Delete associated expenses first
  await prisma.expense.deleteMany({ where: { invoiceId: id } });

  // Delete invoice
  await prisma.invoice.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
