import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// GET: recent notifications + unread count for the current user.
export async function GET() {
  const { user, error } = await getAuthUser();
  if (error) return error;

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, type: true, title: true, body: true, invoiceId: true, read: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return NextResponse.json({ notifications, unread });
}

// PATCH: mark notifications read — { all: true } or { id: "..." }.
export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthUser();
  if (error) return error;

  try {
    const body = await request.json();
    if (body?.all) {
      await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    } else if (body?.id) {
      await prisma.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { read: true } });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
