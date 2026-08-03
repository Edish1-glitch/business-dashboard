import { prisma } from "@/lib/db";

const TOUCH_THROTTLE_MS = 5 * 60 * 1000; // avoid a DB write on every single request

/**
 * Validate a login session id (from the JWT) against the DB and refresh its
 * last-seen. Returns false if the row is missing or belongs to another user —
 * which is how a revoked ("disconnected") device gets logged out at the data
 * layer. Fills in userAgent/ip lazily on first sight (the row is created at
 * login without request headers).
 */
export async function validateAndTouchSession(
  jti: string,
  userId: string,
  userAgent: string | null,
  ip: string | null
): Promise<boolean> {
  const sess = await prisma.session.findUnique({ where: { jti } });
  if (!sess || sess.userId !== userId) return false;

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
