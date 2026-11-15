import { prisma } from "@/lib/db";
import { downloadFromR2 } from "@/lib/r2";
import { readFile } from "fs/promises";
import { htmlToPdf } from "@/lib/html-to-pdf";
import { getGmailClient, sendGmailMessage, canSendEmail, OutgoingAttachment } from "@/lib/gmail";

// Single source of truth for sending invoices as PDF attachments to an email
// (the accountant). Used by both the UI route (/api/invoices/send-email) and the
// MCP `send_to_accountant` tool, so the PDF/MIME/R2 logic lives in exactly one
// place. This function does NOT skip already-sent invoices — callers that want
// that (the MCP tool) filter the ids beforehand.

export async function getFileBuffer(invoice: { fileData: string | null; fileUrl: string | null; filePath: string }): Promise<Buffer> {
  if (invoice.fileUrl && invoice.filePath.startsWith("r2://")) {
    const { buffer } = await downloadFromR2(invoice.fileUrl);
    return buffer;
  }
  if (invoice.fileData) return Buffer.from(invoice.fileData, "base64");
  return await readFile(invoice.filePath);
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", ILS: "₪" };

/** Build a clean, sortable filename: 2026-07_ספק_150₪.pdf */
function smartFileName(inv: {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  date: Date | null;
  createdAt: Date;
  fileName: string;
}): string {
  const d = inv.date || inv.createdAt;
  const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const rawVendor = (inv.vendor || inv.fileName.replace(/\.[^.]+$/, "") || "חשבונית").trim();
  const vendorPart =
    rawVendor
      .replace(/[\/\\:*?"<>| -]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40) || "חשבונית";

  let amountPart = "";
  if (inv.amount !== null && inv.amount !== undefined) {
    const sym = CURRENCY_SYMBOL[inv.currency || "ILS"] || "";
    const amt = Math.round(inv.amount * 100) / 100; // exact amount, no rounding
    amountPart = `_${amt}${sym}`;
  }

  return `${datePart}_${vendorPart}${amountPart}.pdf`;
}

const MAX_TOTAL_BYTES = 24 * 1024 * 1024; // Gmail hard limit is ~25MB

export type SendToAccountantResult =
  | {
      ok: true;
      sentCount: number;
      from: string;
      to: string;
      subject: string;
      sends: { invoiceId: string; sentTo: string; subject: string; fromEmail: string; createdAt: string }[];
    }
  | { ok: false; code: "no_account" | "reconnect" | "too_large" | "no_invoices" | "send_failed"; message: string };

/**
 * Send the given invoices (by id, scoped to userId) as PDF/image attachments to
 * `to`, from a connected Gmail account. Records an InvoiceSend per invoice.
 */
export async function sendInvoicesToAccountant(
  userId: string,
  opts: { invoiceIds: string[]; to: string; subject?: string; body?: string; fromAccountId?: string }
): Promise<SendToAccountantResult> {
  const accounts = await prisma.emailAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (accounts.length === 0) {
    return { ok: false, code: "no_account", message: "לא מחובר חשבון Gmail. חבר חשבון בהגדרות." };
  }

  let sender = opts.fromAccountId
    ? accounts.find((a) => a.id === opts.fromAccountId)
    : accounts.find((a) => canSendEmail(a.scopes) && !a.needsReconnect) || accounts[0];
  if (!sender) sender = accounts[0];

  if (!canSendEmail(sender.scopes) || sender.needsReconnect) {
    return {
      ok: false,
      code: "reconnect",
      message: `לחשבון ${sender.email} אין הרשאת שליחה פעילה (ייתכן שהחיבור פג). חבר אותו מחדש בהגדרות.`,
    };
  }

  const invoices = await prisma.invoice.findMany({ where: { id: { in: opts.invoiceIds }, userId } });
  if (invoices.length === 0) {
    return { ok: false, code: "no_invoices", message: "לא נמצאו חשבוניות" };
  }

  const attachments: OutgoingAttachment[] = [];
  const usedNames = new Map<string, number>();
  let totalBytes = 0;

  for (const invoice of invoices) {
    let buffer = await getFileBuffer(invoice);
    const isHtml = invoice.fileName.endsWith(".html") || invoice.filePath === "inline-html";
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(invoice.fileName);

    let mimeType = "application/pdf";
    let name = smartFileName(invoice);

    if (isHtml) {
      buffer = await htmlToPdf(buffer.toString("utf-8"));
    } else if (isImage) {
      mimeType = "image/png";
      name = name.replace(/\.pdf$/, ".png");
    }

    const count = usedNames.get(name) || 0;
    usedNames.set(name, count + 1);
    if (count > 0) {
      const ext = name.lastIndexOf(".");
      name = `${name.slice(0, ext)}_${count}${name.slice(ext)}`;
    }

    totalBytes += buffer.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return { ok: false, code: "too_large", message: "הקבצים גדולים מדי לשליחה במייל (מעל 24MB). בחר פחות חשבוניות." };
    }

    attachments.push({ fileName: name, buffer, mimeType });
  }

  const finalSubject = (opts.subject && opts.subject.trim()) || "חשבוניות והוצאות";
  const finalBody = typeof opts.body === "string" ? opts.body : "";

  try {
    const gmail = await getGmailClient(sender);
    await sendGmailMessage(gmail, { from: sender.email, to: opts.to.trim(), subject: finalSubject, body: finalBody, attachments });
  } catch (err) {
    console.error("sendInvoicesToAccountant send error:", err);
    const msg =
      err instanceof Error && /invalid_grant|insufficient|permission|scope/i.test(err.message)
        ? "אין הרשאת שליחה. חבר מחדש את חשבון ה-Gmail בהגדרות."
        : "שגיאה בשליחת המייל. נסה שוב.";
    return { ok: false, code: "send_failed", message: msg };
  }

  await prisma.invoiceSend.createMany({
    data: invoices.map((inv) => ({
      invoiceId: inv.id,
      sentTo: opts.to.trim(),
      subject: finalSubject,
      fromEmail: sender!.email,
      userId,
    })),
  });

  const createdAt = new Date().toISOString();
  return {
    ok: true,
    sentCount: invoices.length,
    from: sender.email,
    to: opts.to.trim(),
    subject: finalSubject,
    sends: invoices.map((inv) => ({
      invoiceId: inv.id,
      sentTo: opts.to.trim(),
      subject: finalSubject,
      fromEmail: sender!.email,
      createdAt,
    })),
  };
}
