import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { buildNewInvoicePush, formatInvoiceAmount, type NewInvoiceInfo } from "@/lib/notify-format";

export type { NewInvoiceInfo };

/**
 * Persist an in-app notification row for a newly ingested invoice (feeds the
 * bell/notification center). Push delivery is handled separately by
 * pushNewInvoices so many-at-once syncs collapse into a single push.
 */
export async function recordNewInvoiceNotification(userId: string, invoice: NewInvoiceInfo): Promise<void> {
  const vendor = invoice.vendor || "חשבונית חדשה";
  const amountStr = formatInvoiceAmount(invoice.amount, invoice.currency);
  try {
    await prisma.notification.create({
      data: {
        type: "new-invoice",
        title: "חשבונית חדשה",
        body: amountStr ? `${vendor} · ${amountStr}` : vendor,
        invoiceId: invoice.id,
        userId,
      },
    });
  } catch (e) {
    console.error("Failed to record notification:", e);
  }
}

/**
 * Send a Web Push for invoices discovered in a single sync run (single focused
 * or batched). Never throws — push failures must not break the sync flow.
 */
export async function pushNewInvoices(userId: string, invoices: NewInvoiceInfo[]): Promise<void> {
  const payload = buildNewInvoicePush(invoices);
  if (!payload) return;
  try {
    await sendPushToUser(userId, payload);
  } catch (e) {
    console.error("Failed to push new invoices:", e);
  }
}

/**
 * Alert the user that a connected Gmail mailbox's token expired (invalid_grant)
 * and must be reconnected — otherwise invoices stop being ingested silently.
 * Fire this ONCE, on the transition healthy→expired (callers gate on prior state).
 *
 * Three channels, each isolated so one failing never blocks the others:
 *  - in-app bell (Notification row)
 *  - Web Push (works regardless of Gmail state)
 *  - email, sent from ANOTHER healthy mailbox (the expired one can't send).
 * Never throws.
 */
export async function notifyGmailExpired(
  userId: string,
  account: { id: string; email: string }
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        type: "gmail-expired",
        title: "חיבור Gmail פג",
        body: `${account.email} — צריך לחבר מחדש כדי להמשיך לקלוט חשבוניות`,
        userId,
      },
    });
  } catch (e) {
    console.error("notifyGmailExpired: notification row failed:", e);
  }

  try {
    await sendPushToUser(userId, {
      title: "חיבור Gmail פג ⚠️",
      body: `${account.email} — חבר מחדש בהגדרות`,
      url: "/settings",
      tag: "gmail-expired",
    });
  } catch (e) {
    console.error("notifyGmailExpired: push failed:", e);
  }

  // Email alert — the expired account itself can't send, so send from another
  // connected, still-healthy mailbox of the same user (per the chosen fallback).
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return;

    const sender = await prisma.emailAccount.findFirst({
      where: { userId, needsReconnect: false, refreshToken: { not: null }, id: { not: account.id } },
      orderBy: { createdAt: "asc" },
    });
    if (!sender) return; // no healthy mailbox to send from — push + banner still cover it

    // Lazy-load the heavy googleapis wrapper only when we actually send.
    const { getGmailClient, sendGmailMessage } = await import("@/lib/gmail");
    const gmail = await getGmailClient(sender);
    await sendGmailMessage(gmail, {
      from: sender.email,
      to: user.email,
      subject: "FinDash — חיבור Gmail פג, צריך לחבר מחדש",
      body:
        `החיבור של ${account.email} פג, ו-FinDash הפסיק לקלוט ממנו חשבוניות.\n\n` +
        `כדי לתקן: היכנס ל-FinDash → הגדרות → "חבר מחדש".\n\n` +
        `(הודעה זו נשלחה מ-${sender.email} כי אי אפשר לשלוח מהחשבון שפג.)`,
      attachments: [],
    });
  } catch (e) {
    console.error("notifyGmailExpired: email alert failed:", e);
  }
}
