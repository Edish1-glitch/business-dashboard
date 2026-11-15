// Pure formatters that turn Prisma rows into the plain, stable shapes the MCP
// tools return. Keeping these pure (no prisma/imports) makes them unit-testable
// and keeps the tool handlers readable.

export type InvoiceRow = {
  id: string;
  fileName: string;
  filePath: string;
  fileUrl: string | null;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  date: Date | null;
  source: string;
  status: string;
  isBusiness: boolean;
  creditCardLast4: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  category?: { name: string } | null;
  emailAccount?: { email: string } | null;
  sends?: { sentTo: string; createdAt: Date }[];
};

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;
const day = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

/** Shape a single invoice for MCP output (never includes file bytes). */
export function invoiceToOutput(inv: InvoiceRow) {
  const sends = inv.sends ?? [];
  return {
    id: inv.id,
    vendor: inv.vendor ?? null,
    date: day(inv.date),
    amount: inv.amount ?? null,
    currency: inv.currency ?? "ILS",
    category: inv.category?.name ?? null,
    classification: inv.isBusiness ? ("business" as const) : ("private" as const),
    status: inv.status as "pending" | "approved" | "rejected",
    source: inv.source,
    mailbox: inv.emailAccount?.email ?? null,
    fileName: inv.fileName,
    creditCardLast4: inv.creditCardLast4 ?? null,
    isDeleted: Boolean(inv.deletedAt),
    deletedAt: iso(inv.deletedAt),
    sentToAccountant: sends.length > 0,
    sentAt: sends.length > 0 ? iso(sends[0].createdAt) : null,
    createdAt: iso(inv.createdAt),
  };
}

/** The columns a tool must `select` to build invoiceToOutput (no `fileData`). */
export const INVOICE_SELECT = {
  id: true,
  fileName: true,
  filePath: true,
  fileUrl: true,
  vendor: true,
  amount: true,
  currency: true,
  date: true,
  source: true,
  status: true,
  isBusiness: true,
  creditCardLast4: true,
  createdAt: true,
  deletedAt: true,
  category: { select: { name: true } },
  emailAccount: { select: { email: true } },
  sends: { orderBy: { createdAt: "desc" as const }, select: { sentTo: true, createdAt: true } },
} as const;

/** A compact JSON tool result: a text block whose text is pretty JSON. */
export function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** A tool error result (isError) with a Hebrew-friendly message. */
export function errorResult(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}
