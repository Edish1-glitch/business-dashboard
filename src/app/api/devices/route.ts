import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { describeUserAgent } from "@/lib/user-agent";

// List the current user's active login sessions (devices). The caller's own
// session is flagged `current`. The raw jti is never exposed.
export async function GET() {
  const { user, error, sid } = await getAuthUser();
  if (error) return error;

  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { lastSeenAt: "desc" },
  });

  const devices = sessions.map((s) => ({
    id: s.id,
    label: describeUserAgent(s.userAgent),
    ip: s.ip,
    lastSeenAt: s.lastSeenAt,
    createdAt: s.createdAt,
    current: s.jti === sid,
  }));

  return NextResponse.json({ devices });
}
