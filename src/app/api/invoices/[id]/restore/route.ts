import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Restore a soft-deleted invoice from "נמחקו לאחרונה" (clears deletedAt).
// Its Expense (if approved) re-counts automatically — the dashboard filters
// expenses by invoice.deletedAt, so nothing else needs recreating.
export async function POST(
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

  await prisma.invoice.update({ where: { id }, data: { deletedAt: null } });
  return NextResponse.json({ success: true });
}
