import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Revert invoice back to pending - deletes associated expense
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    return NextResponse.json({ error: "חשבונית לא נמצאה" }, { status: 404 });
  }

  // Delete associated expenses
  await prisma.expense.deleteMany({ where: { invoiceId: id } });

  // Set back to pending
  await prisma.invoice.update({
    where: { id },
    data: { status: "pending" },
  });

  return NextResponse.json({ success: true });
}
