import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateAndTouchSession } from "@/lib/session-tracking";
import { NextResponse } from "next/server";

/**
 * Get the authenticated user for API routes.
 * Returns the user (and its session id) or a 401 response.
 *
 * If the JWT carries a session id (sid), it is validated against the Session
 * table: a missing row means this device was disconnected → 401 (logged out at
 * the data layer). Legacy tokens without a sid pass through untracked.
 */
export async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { user: null, error: NextResponse.json({ error: "לא מורשה" }, { status: 401 }), sid: null };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return { user: null, error: NextResponse.json({ error: "משתמש לא נמצא" }, { status: 401 }), sid: null };
  }

  const sid = (session as { sid?: string }).sid || null;
  if (sid) {
    const h = await headers();
    const userAgent = h.get("user-agent");
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const ok = await validateAndTouchSession(sid, user.id, userAgent, ip);
    if (!ok) {
      return { user: null, error: NextResponse.json({ error: "החיבור נותק" }, { status: 401 }), sid: null };
    }
  }

  return { user, error: null, sid };
}
