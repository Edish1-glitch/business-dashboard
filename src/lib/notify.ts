import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

export interface NewInvoiceInfo {
  id: string;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", ILS: "₪" };

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return "";
  const sym = CURRENCY_SYMBOL[currency || "ILS"] || "₪";
  return `${sym}${amount.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;
}

/**
 * Persist an in-app notification row for a newly ingested invoice (feeds the
 * bell/notification center). Push delivery is handled separately by
 * pushNewInvoices so many-at-once syncs collapse into a single push.
 */
export async function recordNewInvoiceNotification(userId: string, invoice: NewInvoiceInfo): Promise<void> {
  const vendor = invoice.vendor || "חשבונית חדשה";
  const amountStr = formatAmount(invoice.amount, invoice.currency);
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
 * Send a Web Push for invoices discovered in a single sync run.
 * One invoice → a focused push that deep-links to it; several → one batched push.
 * Never throws (push failures must not break the sync flow).
 */
export async function pushNewInvoices(userId: string, invoices: NewInvoiceInfo[]): Promise<void> {
  if (invoices.length === 0) return;
  try {
    if (invoices.length === 1) {
      const inv = invoices[0];
      const vendor = inv.vendor || "חשבונית חדשה";
      const amountStr = formatAmount(inv.amount, inv.currency);
      await sendPushToUser(userId, {
        title: "חשבונית חדשה",
        body: amountStr ? `${vendor} · ${amountStr}` : vendor,
        url: `/invoices/pending?focus=${inv.id}`,
        tag: `invoice-${inv.id}`,
        invoiceId: inv.id,
      });
    } else {
      await sendPushToUser(userId, {
        title: "חשבוניות חדשות",
        body: `${invoices.length} חשבוניות חדשות ממתינות לאישור`,
        url: "/invoices/pending",
        tag: "invoices-batch",
      });
    }
  } catch (e) {
    console.error("Failed to push new invoices:", e);
  }
}
