import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { getGmailClient, searchEmails, getAttachments } from "@/lib/gmail";
import { processAndSave, splitPdfToPageBuffers } from "@/lib/invoice-processor";
import { R2_LIMITS } from "@/lib/r2";

// R2 free tier: 10GB. Stop at 8GB to leave buffer.
const MAX_STORAGE_BYTES = R2_LIMITS.MAX_TOTAL_STORAGE;

/**
 * Estimate total storage used from DB.
 * For R2 files: use actual file sizes tracked in invoices.
 * For DB files: use base64 data length.
 */
async function getStorageUsed(): Promise<number> {
  const invoices = await prisma.invoice.findMany({
    select: { fileData: true, filePath: true },
  });

  let totalBytes = 0;
  for (const inv of invoices) {
    if (inv.filePath.startsWith("r2://") && inv.fileData) {
      // R2 files that also have fileData (shouldn't happen but handle it)
      totalBytes += Buffer.byteLength(inv.fileData, "base64") * 0.75;
    } else if (inv.filePath.startsWith("r2://")) {
      // R2 file without fileData: estimate ~200KB average invoice
      totalBytes += 200 * 1024;
    } else if (inv.fileData) {
      // DB base64 file
      totalBytes += Buffer.byteLength(inv.fileData, "base64") * 0.75;
    }
  }

  return totalBytes;
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    // Get sync parameters
    let afterDate = new Date("2024-01-01");
    try {
      const body = await request.json();
      if (body.afterDate) afterDate = new Date(body.afterDate);
      if (body.accountId) {
        // Sync specific account only
        return syncAccounts(user.id, [body.accountId], afterDate);
      }
    } catch { /* no body = sync all */ }

    // Get all email accounts
    const accounts = await prisma.emailAccount.findMany({
      where: { userId: user.id },
    });

    if (accounts.length === 0) {
      return NextResponse.json({ error: "אין חשבונות אימייל מחוברים" }, { status: 400 });
    }

    return syncAccounts(user.id, accounts.map((a) => a.id), afterDate);
  } catch (error) {
    console.error("Email sync error:", error);
    return NextResponse.json({ error: "שגיאה בסנכרון" }, { status: 500 });
  }
}

async function syncAccounts(userId: string, accountIds: string[], afterDate: Date) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      let totalInvoicesFound = 0;
      let totalDuplicates = 0;
      let totalStorageAdded = 0;
      let storageUsed = await getStorageUsed();
      let lastProcessedDate: Date | null = null;
      let stoppedEarly = false;

      const accounts = await prisma.emailAccount.findMany({
        where: { id: { in: accountIds }, userId },
      });

      send({
        type: "progress",
        message: `מתחיל סנכרון ${accounts.length} חשבונות אימייל...`,
        total: 0, current: 0,
      });

      for (const account of accounts) {
        if (stoppedEarly) break;

        // Use lastSyncAt if available and later than afterDate
        const syncFrom = account.lastSyncAt && account.lastSyncAt > afterDate
          ? account.lastSyncAt
          : afterDate;

        send({
          type: "progress",
          message: `מחפש מיילים עם חשבוניות ב-${account.email}...`,
          total: 0, current: 0,
        });

        let gmail;
        try {
          gmail = await getGmailClient(account);
        } catch (err) {
          send({
            type: "progress",
            message: `שגיאה בהתחברות ל-${account.email}: ${err instanceof Error ? err.message : "שגיאה"}`,
            total: 0, current: 0,
          });
          continue;
        }

        let messageIds: string[];
        try {
          messageIds = await searchEmails(gmail, syncFrom);
        } catch (err) {
          send({
            type: "progress",
            message: `שגיאה בחיפוש מיילים ב-${account.email}: ${err instanceof Error ? err.message : "שגיאה"}`,
            total: 0, current: 0,
          });
          continue;
        }

        send({
          type: "progress",
          message: `נמצאו ${messageIds.length} מיילים עם קבצים מצורפים ב-${account.email}`,
          total: messageIds.length, current: 0,
        });

        let processedMessages = 0;

        for (const msgId of messageIds) {
          if (stoppedEarly) break;

          // Check storage limit
          if (storageUsed + totalStorageAdded >= MAX_STORAGE_BYTES) {
            stoppedEarly = true;
            send({
              type: "progress",
              message: `נפח האחסון מתקרב למגבלה (${((storageUsed + totalStorageAdded) / 1024 / 1024 / 1024).toFixed(2)}GB מתוך 10GB). עוצר סנכרון.`,
              total: messageIds.length, current: processedMessages,
            });
            break;
          }

          processedMessages++;

          let attachments;
          try {
            attachments = await getAttachments(gmail, msgId);
          } catch {
            continue; // skip failed messages
          }

          if (attachments.length === 0) continue;

          // Track the date of this message for lastSyncAt
          const msgDate = attachments[0]?.messageDate;
          if (msgDate && (!lastProcessedDate || msgDate > lastProcessedDate)) {
            lastProcessedDate = msgDate;
          }

          for (const att of attachments) {
            if (stoppedEarly) break;

            // Check storage before each file
            if (storageUsed + totalStorageAdded + att.buffer.length >= MAX_STORAGE_BYTES) {
              stoppedEarly = true;
              break;
            }

            try {
              // Split PDFs into pages (like upload does)
              const pages = await splitPdfToPageBuffers(att.buffer, att.fileName);

              for (const page of pages) {
                if (storageUsed + totalStorageAdded + page.buffer.length >= MAX_STORAGE_BYTES) {
                  stoppedEarly = true;
                  break;
                }

                const result = await processAndSave(
                  page.buffer, page.fileName, userId, page.isImage, "email"
                );

                if (result.duplicate) {
                  totalDuplicates++;
                } else if (result.id) {
                  totalInvoicesFound++;
                  totalStorageAdded += page.buffer.length;
                }
              }
            } catch {
              // Skip failed attachments
            }
          }

          // Progress update every message
          const storageMB = ((storageUsed + totalStorageAdded) / 1024 / 1024).toFixed(0);
          send({
            type: "progress",
            message: `מעבד מייל ${processedMessages} מתוך ${messageIds.length} ב-${account.email} (${totalInvoicesFound} חשבוניות, ${storageMB}MB)`,
            total: messageIds.length,
            current: processedMessages,
          });

          // Rate limit delay
          await new Promise((r) => setTimeout(r, 100));
        }

        // Update lastSyncAt for this account
        if (lastProcessedDate || !stoppedEarly) {
          await prisma.emailAccount.update({
            where: { id: account.id },
            data: {
              lastSyncAt: stoppedEarly && lastProcessedDate
                ? lastProcessedDate
                : new Date(),
            },
          });
        }
      }

      // Final summary
      const remainingGB = ((MAX_STORAGE_BYTES - storageUsed - totalStorageAdded) / 1024 / 1024 / 1024).toFixed(2);
      const usedGB = ((storageUsed + totalStorageAdded) / 1024 / 1024 / 1024).toFixed(2);

      let summaryMessage = `סנכרון הושלם: ${totalInvoicesFound} חשבוניות חדשות`;
      if (totalDuplicates > 0) summaryMessage += `, ${totalDuplicates} כפילויות דולגו`;
      summaryMessage += ` (${usedGB}GB מתוך 10GB, נותרו ${remainingGB}GB)`;

      if (stoppedEarly && lastProcessedDate) {
        summaryMessage += `\nהסנכרון הגיע עד ${lastProcessedDate.toLocaleDateString("he-IL")}. ניתן להמשיך מאוחר יותר.`;
      }

      send({
        type: "done",
        success: true,
        totalInvoices: totalInvoicesFound,
        duplicatesSkipped: totalDuplicates,
        storageUsedGB: usedGB,
        storageRemainingGB: remainingGB,
        stoppedEarly,
        lastProcessedDate: lastProcessedDate?.toISOString() || null,
        message: summaryMessage,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
