import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { runSync } from "@/lib/sync-account";
import { R2_LIMITS } from "@/lib/r2";

// R2 free tier: 10GB. Stop at this cap to leave buffer.
const MAX_STORAGE_BYTES = R2_LIMITS.MAX_TOTAL_STORAGE;

// GET: return sync ranges for user's accounts
export async function GET() {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    const accounts = await prisma.emailAccount.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        email: true,
        syncRanges: {
          orderBy: { fromDate: "desc" },
          select: { id: true, fromDate: true, toDate: true, invoicesFound: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({ accounts });
  } catch {
    return NextResponse.json({ accounts: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await getAuthUser();
    if (error) return error;

    // Get sync parameters
    let afterDate = new Date("2024-01-01");
    let toDate: Date | null = null;
    let accountIds: string[] | null = null;

    try {
      const body = await request.json();
      if (body.afterDate) afterDate = new Date(body.afterDate);
      if (body.toDate) toDate = new Date(body.toDate);
      if (body.accountId) accountIds = [body.accountId];
    } catch { /* no body = sync all */ }

    // Get accounts
    const accounts = await prisma.emailAccount.findMany({
      where: accountIds ? { id: { in: accountIds }, userId: user.id } : { userId: user.id },
    });

    if (accounts.length === 0) {
      return NextResponse.json({ error: "אין חשבונות אימייל מחוברים" }, { status: 400 });
    }

    return streamSync(user.id, accounts.map((a) => a.id), afterDate, toDate);
  } catch (error) {
    console.error("Email sync error:", error);
    return NextResponse.json({ error: "שגיאה בסנכרון" }, { status: 500 });
  }
}

/**
 * Manual sync: runs the shared runSync core and streams its progress as
 * newline-delimited JSON. No push notifications here — the user is watching the
 * progress live; background push is handled by the cron endpoint instead.
 */
function streamSync(userId: string, accountIds: string[], afterDate: Date, toDate: Date | null = null) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));

      try {
        const result = await runSync(userId, accountIds, afterDate, toDate, {
          onProgress: (p) => send({ type: "progress", message: p.message, current: p.current, total: p.total }),
        });

        const usedBytes = result.storageUsed + result.totalStorageAdded;
        const remainingGB = ((MAX_STORAGE_BYTES - usedBytes) / 1024 / 1024 / 1024).toFixed(2);
        const usedGB = (usedBytes / 1024 / 1024 / 1024).toFixed(2);

        let summaryMessage = `סנכרון הושלם: ${result.totalInvoicesFound} חשבוניות חדשות`;
        if (result.totalDuplicates > 0) summaryMessage += `, ${result.totalDuplicates} כפילויות דולגו`;
        summaryMessage += ` (${usedGB}GB מתוך 10GB, נותרו ${remainingGB}GB)`;

        if (result.stoppedEarly && result.lastProcessedDate) {
          summaryMessage += `\nהסנכרון הגיע עד ${result.lastProcessedDate.toLocaleDateString("he-IL")}. ניתן להמשיך מאוחר יותר.`;
        }

        if (result.failedAccounts.length > 0) {
          summaryMessage += `\n\n⚠️ ${result.failedAccounts.length} חשבונות לא סונכרנו:`;
          for (const f of result.failedAccounts) summaryMessage += `\n• ${f.email} — ${f.reason}`;
          if (result.failedAccounts.some((f) => f.needsReconnect)) {
            summaryMessage += `\nחבר מחדש את החשבון/ות מכפתור "חבר Gmail" ונסה שוב.`;
          }
        }

        send({
          type: "done",
          success: result.failedAccounts.length === 0,
          totalInvoices: result.totalInvoicesFound,
          duplicatesSkipped: result.totalDuplicates,
          storageUsedGB: usedGB,
          storageRemainingGB: remainingGB,
          stoppedEarly: result.stoppedEarly,
          failedAccounts: result.failedAccounts,
          lastProcessedDate: result.lastProcessedDate?.toISOString() || null,
          message: summaryMessage,
        });
      } catch (e) {
        console.error("Sync stream error:", e);
        // start() must ALWAYS emit a done event, even on failure.
        send({ type: "done", success: false, totalInvoices: 0, duplicatesSkipped: 0, failedAccounts: [], message: "שגיאה בסנכרון" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
