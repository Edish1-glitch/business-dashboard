/**
 * One-time migration: normalize Invoice.date and Expense.date to a timezone-proof
 * calendar day (midnight UTC).
 *
 * Why: invoice dates used to be built with `new Date(y, m, d)`, which anchors the
 * value to the *server's* timezone. Rows processed on the UTC prod box landed at
 * `T00:00:00Z`, but rows processed on the Asia/Jerusalem dev box landed at
 * `T21:00:00Z` / `T22:00:00Z` — i.e. midnight of the *next* Israeli day. Anything
 * that read the raw UTC day (`.split("T")[0]`, `.slice(0,10)`, `.toISOString()`,
 * or a `timeZone:"UTC"` formatter) therefore showed those rows one day early.
 *
 * Fix: the intended calendar day is the day as seen in Asia/Jerusalem (true for
 * both UTC-midnight and Israel-midnight rows). Re-store each date as
 * `Date.UTC(thatY, thatM, thatD)`. Idempotent — already-canonical rows don't move.
 *
 * Usage:
 *   set -a && . ./.env && set +a && npx tsx scripts/fix-invoice-dates.ts          # dry run
 *   set -a && . ./.env && set +a && npx tsx scripts/fix-invoice-dates.ts --apply  # write
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const APPLY = process.argv.includes("--apply");
const JERUSALEM = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The canonical (midnight-UTC) instant for the Jerusalem calendar day of `d`. */
function canonical(d: Date): Date {
  const [y, m, day] = JERUSALEM.format(d).split("-").map(Number); // en-CA => YYYY-MM-DD
  return new Date(Date.UTC(y, m - 1, day));
}

async function run() {
  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({ where: { date: { not: null } }, select: { id: true, date: true } }),
    prisma.expense.findMany({ select: { id: true, date: true } }),
  ]);

  const backup: { table: string; id: string; old: string }[] = [];
  const changes: { table: string; id: string; old: string; next: string }[] = [];

  const scan = (table: string, rows: { id: string; date: Date | null }[]) => {
    for (const r of rows) {
      if (!r.date) continue;
      backup.push({ table, id: r.id, old: r.date.toISOString() });
      const next = canonical(r.date);
      if (next.getTime() !== r.date.getTime()) {
        changes.push({ table, id: r.id, old: r.date.toISOString(), next: next.toISOString() });
      }
    }
  };
  scan("invoice", invoices);
  scan("expense", expenses);

  console.log(`Scanned ${invoices.length} invoices + ${expenses.length} expenses.`);
  console.log(`Rows needing a shift: ${changes.length}`);
  const byTable = changes.reduce<Record<string, number>>((a, c) => ((a[c.table] = (a[c.table] || 0) + 1), a), {});
  console.log("By table:", byTable);
  console.log("\nSample changes (up to 15):");
  for (const c of changes.slice(0, 15)) {
    console.log(`  ${c.table} ${c.id.slice(0, 8)}  ${c.old}  ->  ${c.next}`);
  }

  const backupPath = `/tmp/invoice-dates-backup-${invoices.length + expenses.length}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup of ALL current date values written to ${backupPath}`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to persist.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nApplying ${changes.length} updates...`);
  let done = 0;
  for (const c of changes) {
    const data = { date: new Date(c.next) };
    if (c.table === "invoice") await prisma.invoice.update({ where: { id: c.id }, data });
    else await prisma.expense.update({ where: { id: c.id }, data });
    if (++done % 25 === 0) console.log(`  ${done}/${changes.length}`);
  }
  console.log(`Done. Updated ${done} rows.`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
