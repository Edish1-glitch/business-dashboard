import { prisma } from "@/lib/db";

const TOUCH_THROTTLE_MS = 5 * 60 * 1000; // avoid a DB write on every single request

/**
 * Track a login session (device) and enforce revocation.
 *
 * Design note: a MISSING row must NOT block auth. A JWT can legitimately carry a
 * sid with no row (row lost, created on a different deploy, or never persisted).
 * Treating "missing" as revoked locked users out. Instead we self-heal: missing →
 * recreate the row and allow. ONLY an explicit `revoked` flag ("disconnect this
 * device") blocks auth. Returns false only when the session was revoked.
 */
export async function touchSession(
  jti: string,
  userId: string,
  userAgent: string | null,
  ip: string | null
): Promise<boolean> {
  const sess = await prisma.session.findUnique({ where: { jti } });

  if (!sess) {
    // Self-heal: create the row for this device instead of rejecting.
    await prisma.session
      .create({ data: { jti, userId, userAgent: userAgent || undefined, ip: ip || undefined } })
      .catch(() => {});
    return true;
  }

  if (sess.userId !== userId) return true; // not our row to judge; don't block
  if (sess.revoked) return false; // explicit disconnect → block (logs the device out)

  const needsMeta = (!sess.userAgent && userAgent) || (!sess.ip && ip);
  const stale = Date.now() - sess.lastSeenAt.getTime() > TOUCH_THROTTLE_MS;
  if (needsMeta || stale) {
    await prisma.session
      .update({
        where: { jti },
        data: {
          lastSeenAt: new Date(),
          ...(sess.userAgent ? {} : userAgent ? { userAgent } : {}),
          ...(sess.ip ? {} : ip ? { ip } : {}),
        },
      })
      .catch(() => {});
  }
  return true;
}
