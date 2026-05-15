import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const { id } = await params;

    const account = await prisma.emailAccount.findUnique({ where: { id } });
    if (!account || account.userId !== user.id) {
      return NextResponse.json({ error: "חשבון לא נמצא" }, { status: 404 });
    }

    await prisma.emailAccount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete email account error:", error);
    return NextResponse.json({ error: "שגיאה במחיקת חשבון" }, { status: 500 });
  }
}
