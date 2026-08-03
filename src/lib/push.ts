import webpush from "web-push";
import { prisma } from "@/lib/db";

// VAPID identifies our server to the push service. Keys are generated once
// (npx web-push generate-vapid-keys) and stored in env. The public key is also
// exposed to the client via NEXT_PUBLIC_VAPID_PUBLIC_KEY for pushManager.subscribe.
let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@findash.app";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // where notificationclick should navigate
  tag?: string; // collapses notifications with the same tag
  invoiceId?: string;
}

/**
 * Send a web-push notification to every subscription belonging to a user.
 * Expired/invalid subscriptions (404/410) are pruned automatically.
 * Never throws — push failures must not break the calling flow (e.g. sync).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        delivered++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404 = endpoint gone, 410 = subscription expired → prune it.
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("Push send failed:", statusCode, (err as Error)?.message);
        }
      }
    })
  );

  return delivered;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
