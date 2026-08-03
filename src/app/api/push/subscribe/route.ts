import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Save (or refresh) a Web Push subscription for the current user.
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser();
  if (error) return error;

  try {
    const body = await request.json();
    const endpoint: string | undefined = body?.endpoint;
    const p256dh: string | undefined = body?.keys?.p256dh;
    const auth: string | undefined = body?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "מנוי לא תקין" }, { status: 400 });
    }

    const userAgent = request.headers.get("user-agent") || null;

    // endpoint is globally unique; upsert so re-subscribing (or moving the sub to
    // this user) just updates the keys instead of erroring on the unique index.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth, userAgent, userId: user.id },
      create: { endpoint, p256dh, auth, userAgent, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Push subscribe error:", e);
    return NextResponse.json({ error: "שגיאה בשמירת המנוי" }, { status: 500 });
  }
}
