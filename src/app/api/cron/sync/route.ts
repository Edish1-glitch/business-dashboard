import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSync } from "@/lib/sync-account";
import { recordNewInvoiceNotification, pushNewInvoices, type NewInvoiceInfo } from "@/lib/notify";

// Background incremental sync for ALL users, triggered by an external scheduler
// (GitHub Actions) with a shared secret. No user session. Detects invoices that
// arrived since each account's last sync and pushes a notification per user.
//
// Only accounts already synced at least once (lastSyncAt set) are included — the
// initial full/historical sync stays a manual, user-initiated action from Settings,
// so the cron never floods with a first-time backfill.

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : headerSecret;
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Group incremental-eligible accounts by user.
  const accounts = await prisma.emailAccount.findMany({
    where: { lastSyncAt: { not: null } },
    select: { id: true, userId: true },
  });

  const byUser = new Map<string, string[]>();
  for (const a of accounts) {
    const list = byUser.get(a.userId) || [];
    list.push(a.id);
    byUser.set(a.userId, list);
  }

  const epoch = new Date(0); // runSync falls back to each account's lastSyncAt (always later than epoch)
  let usersProcessed = 0;
  let totalNew = 0;
  const errors: string[] = [];

  // Sequential per user (memory: never run multiple Gmail syncs at once).
  for (const [userId, accountIds] of byUser) {
    const fresh: NewInvoiceInfo[] = [];
    try {
      await runSync(userId, accountIds, epoch, null, {
        onNewInvoice: async (inv) => {
          fresh.push(inv);
          await recordNewInvoiceNotification(userId, inv);
        },
      });
      if (fresh.length > 0) {
        await pushNewInvoices(userId, fresh);
        totalNew += fresh.length;
      }
      usersProcessed++;
    } catch (e) {
      console.error(`cron sync failed for user ${userId}:`, e);
      errors.push(userId);
    }
  }

  return NextResponse.json({ ok: true, usersProcessed, totalNew, errors: errors.length });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

// GET supported too, so a simple scheduler ping (curl) works.
export async function GET(request: NextRequest) {
  return handle(request);
}
