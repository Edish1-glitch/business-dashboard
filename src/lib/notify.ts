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
