import type { PushPayload } from "@/lib/push"; // type-only → no runtime import of push.ts

export interface NewInvoiceInfo {
  id: string;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", ILS: "₪" };

/** Format an invoice amount for notification text, e.g. "₪47.65". Empty if no amount. */
export function formatInvoiceAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return "";
  const sym = CURRENCY_SYMBOL[currency || "ILS"] || "₪";
  return `${sym}${amount.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;
}

/**
 * Build the Web Push payload for invoices discovered in a single sync run —
 * pure (no I/O) so it's unit-testable. One invoice → a focused push that
 * deep-links to it; several → one batched push; none → null.
 */
export function buildNewInvoicePush(invoices: NewInvoiceInfo[]): PushPayload | null {
  if (invoices.length === 0) return null;

  if (invoices.length === 1) {
    const inv = invoices[0];
    const vendor = inv.vendor || "חשבונית חדשה";
    const amountStr = formatInvoiceAmount(inv.amount, inv.currency);
    return {
      title: "חשבונית חדשה",
      body: amountStr ? `${vendor} · ${amountStr}` : vendor,
      url: `/invoices/pending?focus=${inv.id}`,
      tag: `invoice-${inv.id}`,
      invoiceId: inv.id,
    };
  }

  return {
    title: "חשבוניות חדשות",
    body: `${invoices.length} חשבוניות חדשות ממתינות לאישור`,
    url: "/invoices/pending",
    tag: "invoices-batch",
  };
}
