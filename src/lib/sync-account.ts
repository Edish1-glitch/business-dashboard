import { prisma } from "@/lib/db";
import { getGmailClient, searchEmails, getAttachments, getInlineInvoice, htmlToText } from "@/lib/gmail";
import { processAndSave, splitPdfToPageBuffers } from "@/lib/invoice-processor";
import { extractInvoiceData, isNegativeInvoice, hasInvoiceSignals } from "@/lib/pdf/categorize";
import { R2_LIMITS } from "@/lib/r2";
import type { NewInvoiceInfo } from "@/lib/notify";

// R2 free tier: 10GB. Stop at the configured cap to leave buffer.
const MAX_STORAGE_BYTES = R2_LIMITS.MAX_TOTAL_STORAGE;

export interface SyncProgress {
  message: string;
  current: number;
  total: number;
}

export interface SyncCallbacks {
  // Emit a human-readable progress line (used by the manual streaming route).
  onProgress?: (p: SyncProgress) => void;
  // Fired once per newly-created invoice (used by the background cron to notify).
  onNewInvoice?: (invoice: NewInvoiceInfo) => void | Promise<void>;
}

export interface SyncResult {
  totalInvoicesFound: number;
  totalDuplicates: number;
  totalStorageAdded: number;
  storageUsed: number;
  lastProcessedDate: Date | null;
  stoppedEarly: boolean;
  failedAccounts: { email: string; reason: string; needsReconnect: boolean }[];
}

/**
 * Estimate total storage used from DB (arithmetic in SQL — never loads blobs).
 * Decoded bytes ≈ base64 length * 0.75 for DB-stored files, ~200KB per R2 file.
 */
export async function getStorageUsed(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<[{ total: number | null }]>(
    `SELECT COALESCE(SUM(
        CASE
          WHEN "fileData" IS NOT NULL THEN LENGTH("fileData") * 0.75
          WHEN "filePath" LIKE 'r2://%' THEN 204800
          ELSE 0
        END
      ), 0)::float8 AS total FROM "Invoice"`
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Core Gmail → invoice ingestion for a set of accounts. Shared by the manual
 * streaming endpoint (via onProgress) and the background cron (via onNewInvoice).
 *
 * Memory invariants preserved from the original inline implementation:
 * accounts are processed sequentially; PDFs are split and each page processed +
 * released one at a time; storage is summed in SQL; no blob is ever loaded to
 * count bytes. Do not parallelize accounts/pages here.
 */
export async function runSync(
  userId: string,
  accountIds: string[],
  afterDate: Date,
  toDate: Date | null,
  callbacks: SyncCallbacks = {}
): Promise<SyncResult> {
  const { onProgress, onNewInvoice } = callbacks;
  const progress = (message: string, current = 0, total = 0) => onProgress?.({ message, current, total });

  let totalInvoicesFound = 0;
  let totalDuplicates = 0;
  let totalStorageAdded = 0;
  const storageUsed = await getStorageUsed();
  let lastProcessedDate: Date | null = null;
  let stoppedEarly = false;
  const failedAccounts: { email: string; reason: string; needsReconnect: boolean }[] = [];

  const accounts = await prisma.emailAccount.findMany({
    where: { id: { in: accountIds }, userId },
  });

  progress(`מתחיל סנכרון ${accounts.length} חשבונות אימייל...`);

  for (const account of accounts) {
    if (stoppedEarly) break;

    // Use lastSyncAt if available and later than afterDate
    const syncFrom = account.lastSyncAt && account.lastSyncAt > afterDate ? account.lastSyncAt : afterDate;

    progress(`מחפש מיילים עם חשבוניות ב-${account.email}...`);

    let gmail;
    try {
      gmail = await getGmailClient(account);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "שגיאה";
      const needsReconnect = /invalid_grant|invalid_token|unauthorized|לא מחובר/i.test(raw);
      failedAccounts.push({ email: account.email, reason: needsReconnect ? "החיבור פג — צריך לחבר מחדש" : raw, needsReconnect });
      progress(`⚠️ ${account.email}: ${needsReconnect ? "החיבור פג, צריך לחבר מחדש" : raw}`);
      continue;
    }

    let messageIds: string[];
    try {
      messageIds = await searchEmails(gmail, syncFrom, toDate);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "שגיאה";
      const needsReconnect = /invalid_grant|invalid_token|unauthorized/i.test(raw);
      failedAccounts.push({ email: account.email, reason: needsReconnect ? "החיבור פג — צריך לחבר מחדש" : raw, needsReconnect });
      progress(`⚠️ שגיאה בחיפוש מיילים ב-${account.email}: ${raw}`);
      continue;
    }

    progress(`נמצאו ${messageIds.length} מיילים עם קבצים מצורפים ב-${account.email}`, 0, messageIds.length);

    let processedMessages = 0;

    for (const msgId of messageIds) {
      if (stoppedEarly) break;

      if (storageUsed + totalStorageAdded >= MAX_STORAGE_BYTES) {
        stoppedEarly = true;
        progress(
          `נפח האחסון מתקרב למגבלה (${((storageUsed + totalStorageAdded) / 1024 / 1024 / 1024).toFixed(2)}GB מתוך 10GB). עוצר סנכרון.`,
          processedMessages,
          messageIds.length
        );
        break;
      }

      processedMessages++;

      // Strategy 1: Process file attachments
      let attachments: Awaited<ReturnType<typeof getAttachments>> = [];
      try {
        attachments = await getAttachments(gmail, msgId);
      } catch {
        attachments = [];
      }

      let msgDate: Date | null = null;

      if (attachments.length > 0) {
        msgDate = attachments[0]?.messageDate;

        for (const att of attachments) {
          if (stoppedEarly) break;
          if (storageUsed + totalStorageAdded + att.buffer.length >= MAX_STORAGE_BYTES) {
            stoppedEarly = true;
            break;
          }

          try {
            const pages = await splitPdfToPageBuffers(att.buffer, att.fileName);
            for (const page of pages) {
              if (storageUsed + totalStorageAdded + page.buffer.length >= MAX_STORAGE_BYTES) {
                stoppedEarly = true;
                break;
              }
              const result = await processAndSave(page.buffer, page.fileName, userId, page.isImage, "email", account.id);
              if (result.duplicate) {
                totalDuplicates++;
              } else if (result.id) {
                totalInvoicesFound++;
                totalStorageAdded += page.buffer.length;
                await onNewInvoice?.({ id: result.id, vendor: result.vendor, amount: result.amount, currency: result.currency });
              }
            }
          } catch { /* skip failed */ }
        }
      }

      // Strategy 2: Extract inline invoice from email HTML body
      if (attachments.length === 0) {
        try {
          const inline = await getInlineInvoice(gmail, msgId);
          if (inline) {
            msgDate = inline.date;
            const text = inline.textBody || htmlToText(inline.htmlBody);

            if (isNegativeInvoice(text) || isNegativeInvoice(inline.subject)) continue;
            if (!hasInvoiceSignals(text) && !hasInvoiceSignals(inline.subject)) continue;

            const invoiceData = extractInvoiceData(text);

            if (invoiceData.amount) {
              const htmlContent = inline.htmlBody || `<pre>${text}</pre>`;
              const buffer = Buffer.from(htmlContent, "utf-8");

              const { createHash } = await import("crypto");
              const hash = createHash("sha256").update(buffer).digest("hex");
              const existing = await prisma.invoice.findFirst({ where: { fileHash: hash, userId } });

              if (!existing) {
                let categoryId: string | null = null;
                if (invoiceData.category) {
                  const cat = await prisma.category.findFirst({ where: { name: invoiceData.category } });
                  categoryId = cat?.id || null;
                }

                const created = await prisma.invoice.create({
                  data: {
                    fileName: `email-${inline.subject.slice(0, 50)}.html`,
                    filePath: "inline-html",
                    fileHash: hash,
                    fileData: buffer.toString("base64"),
                    vendor: invoiceData.vendor,
                    amount: invoiceData.amount,
                    currency: invoiceData.currency || "ILS",
                    date: invoiceData.date || inline.date,
                    source: "email",
                    status: "pending",
                    creditCardLast4: invoiceData.creditCardLast4,
                    categoryId,
                    userId,
                    emailAccountId: account.id,
                  },
                });
                totalInvoicesFound++;
                await onNewInvoice?.({ id: created.id, vendor: invoiceData.vendor, amount: invoiceData.amount, currency: invoiceData.currency || "ILS" });
              } else {
                totalDuplicates++;
              }
            }
          }
        } catch { /* skip failed inline extraction */ }
      }

      if (msgDate && (!lastProcessedDate || msgDate > lastProcessedDate)) {
        lastProcessedDate = msgDate;
      }

      const storageMB = ((storageUsed + totalStorageAdded) / 1024 / 1024).toFixed(0);
      progress(
        `מעבד מייל ${processedMessages} מתוך ${messageIds.length} ב-${account.email} (${totalInvoicesFound} חשבוניות, ${storageMB}MB)`,
        processedMessages,
        messageIds.length
      );

      // Rate limit delay
      await new Promise((r) => setTimeout(r, 100));
    }

    // Update lastSyncAt and save sync range
    if (lastProcessedDate || !stoppedEarly) {
      const syncEndDate = stoppedEarly && lastProcessedDate ? lastProcessedDate : (toDate || new Date());

      await prisma.emailAccount.update({
        where: { id: account.id },
        data: { lastSyncAt: syncEndDate },
      });

      await prisma.syncRange.create({
        data: {
          fromDate: syncFrom,
          toDate: syncEndDate,
          invoicesFound: totalInvoicesFound,
          emailAccountId: account.id,
        },
      });
    }
  }

  return { totalInvoicesFound, totalDuplicates, totalStorageAdded, storageUsed, lastProcessedDate, stoppedEarly, failedAccounts };
}
