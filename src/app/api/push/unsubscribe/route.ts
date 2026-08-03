import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Remove a Web Push subscription (user disabled notifications on this device).
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser();
  if (error) return error;

  try {
    const body = await request.json();
    const endpoint: string | undefined = body?.endpoint;
    if (!endpoint) return NextResponse.json({ error: "חסר endpoint" }, { status: 400 });

    // Scope by userId so a session can only delete its own subscriptions.
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Push unsubscribe error:", e);
    return NextResponse.json({ error: "שגיאה בביטול המנוי" }, { status: 500 });
  }
}
