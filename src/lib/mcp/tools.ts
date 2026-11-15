import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { prisma } from "@/lib/db";
import { userIdFromCtx, clientIdFromCtx } from "@/lib/mcp/auth";
import { jsonResult, errorResult, invoiceToOutput, INVOICE_SELECT } from "@/lib/mcp/format";
import { logMcpAction } from "@/lib/mcp/log";
import { signFileLink } from "@/lib/mcp/file-link";
import { runSync } from "@/lib/sync-account";
import { sendInvoicesToAccountant } from "@/lib/invoice-send";
import { rateLimit } from "@/lib/rate-limit";

// ── helpers ──────────────────────────────────────────────────────────────────

type ToolRun = (args: Record<string, unknown>, userId: string) => Promise<unknown>;

function safeSummary(args: unknown): string {
  try {
    return JSON.stringify(args ?? {}).slice(0, 300);
  } catch {
    return "";
  }
}

/** Register a tool with uniform auth-scoping, audit logging and error shaping. */
function defineTool(
  server: McpServer,
  name: string,
  config: { title: string; description: string; inputSchema: z.ZodType },
  run: ToolRun
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.registerTool(name, config as any, async (args: any, ctx: any) => {
    let userId: string;
    let clientId: string;
    try {
      userId = userIdFromCtx(ctx);
      clientId = clientIdFromCtx(ctx);
    } catch {
      return errorResult("לא מאומת");
    }
    const summary = safeSummary(args);
    try {
      const result = await run(args ?? {}, userId);
      await logMcpAction({ userId, clientId, tool: name, summary, ok: true });
      return jsonResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה לא ידועה";
      await logMcpAction({ userId, clientId, tool: name, summary, ok: false, result: msg });
      return errorResult(`שגיאה ב-${name}: ${msg}`);
    }
  });
}

/** Parse "YYYY-MM-DD" as midnight UTC (FinDash's calendar-day convention). */
function parseDay(s?: string): Date | undefined {
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function dateRangeFilter(from?: string, to?: string) {
  const gte = parseDay(from);
  const lte = parseDay(to);
  if (!gte && !lte) return undefined;
  return { ...(gte && { gte }), ...(lte && { lte }) };
}

async function approveOne(userId: string, id: string): Promise<"approved" | "already" | "notfound"> {
  const inv = await prisma.invoice.findFirst({ where: { id, userId } });
  if (!inv) return "notfound";
  if (inv.status === "approved") return "already";

  let creditCardId: string | null = null;
  if (inv.creditCardLast4) {
    const card = await prisma.creditCard.findFirst({ where: { userId, lastFour: inv.creditCardLast4 } });
    creditCardId = card?.id ?? null;
  }
  await prisma.invoice.update({ where: { id }, data: { status: "approved" } });
  if (inv.amount) {
    await prisma.expense.create({
      data: {
        amount: inv.amount,
        description: inv.vendor || inv.fileName,
        date: inv.date || new Date(),
        source: "pdf",
        paymentMethod: inv.creditCardLast4 ? "credit-card" : "cash",
        isBusiness: inv.isBusiness,
        categoryId: inv.categoryId,
        creditCardId,
        invoiceId: inv.id,
        userId,
      },
    });
  }
  return "approved";
}

// ── tool registration ────────────────────────────────────────────────────────

export function registerFindashTools(server: McpServer) {
  // get_overview ──────────────────────────────────────────────────────────────
  defineTool(
    server,
    "get_overview",
    {
      title: "סקירה כללית",
      description:
        "סיכום לתקופה (ברירת מחדל: הכל): סה\"כ חשבוניות, עסקי מול פרטי (ספירה וסכום), כמה ממתינות, כמה מאושרות, כמה עסקיות מאושרות עדיין לא נשלחו לרו\"ח, וסטטוס כל תיבת Gmail. טווח תאריכים אופציונלי (ISO yyyy-mm-dd).",
      inputSchema: z.object({
        from: z.string().optional().describe("תאריך התחלה yyyy-mm-dd"),
        to: z.string().optional().describe("תאריך סיום yyyy-mm-dd"),
      }),
    },
    async (args, userId) => {
      const date = dateRangeFilter(args.from as string, args.to as string);
      const base = { userId, deletedAt: null, ...(date && { date }) };
      const [total, pending, approved, business, priv, notSent, mailboxes] = await Promise.all([
        prisma.invoice.count({ where: base }),
        prisma.invoice.count({ where: { ...base, status: "pending" } }),
        prisma.invoice.count({ where: { ...base, status: "approved" } }),
        prisma.invoice.aggregate({ where: { ...base, isBusiness: true }, _count: true, _sum: { amount: true } }),
        prisma.invoice.aggregate({ where: { ...base, isBusiness: false }, _count: true, _sum: { amount: true } }),
        prisma.invoice.count({ where: { ...base, status: "approved", isBusiness: true, sends: { none: {} } } }),
        prisma.emailAccount.findMany({
          where: { userId },
          select: { email: true, needsReconnect: true, lastSyncAt: true, lastError: true, lastErrorAt: true },
        }),
      ]);
      const businessSum = business._sum.amount ?? 0;
      const privateSum = priv._sum.amount ?? 0;
      return {
        period: { from: args.from ?? null, to: args.to ?? null },
        totals: {
          invoices: total,
          amount: Math.round((businessSum + privateSum) * 100) / 100,
          business: { count: business._count, amount: Math.round(businessSum * 100) / 100 },
          private: { count: priv._count, amount: Math.round(privateSum * 100) / 100 },
        },
        pending,
        approved,
        businessApprovedNotSentToAccountant: notSent,
        mailboxes: mailboxes.map((m) => ({
          email: m.email,
          status: m.needsReconnect ? "expired" : "connected",
          lastSyncAt: m.lastSyncAt ? m.lastSyncAt.toISOString() : null,
          lastError: m.lastError ?? null,
          lastErrorAt: m.lastErrorAt ? m.lastErrorAt.toISOString() : null,
        })),
      };
    }
  );

  // list_invoices ───────────────────────────────────────────────────────────────
  defineTool(
    server,
    "list_invoices",
    {
      title: "רשימת חשבוניות",
      description:
        "רשימת חשבוניות עם סינון ועימוד. סינון לפי סטטוס, עסקי/פרטי, נשלח לרו\"ח או לא, טווח תאריכים, ספק, קטגוריה, תיבה, ומחוקים. מחזיר id, ספק, תאריך, סכום, מטבע, קטגוריה, סיווג, סטטוס, מקור, נשלח-לרו\"ח.",
      inputSchema: z.object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        classification: z.enum(["business", "private"]).optional(),
        sentToAccountant: z.boolean().optional().describe("true=נשלח, false=לא נשלח"),
        from: z.string().optional(),
        to: z.string().optional(),
        vendor: z.string().optional().describe("חלק משם הספק"),
        categoryId: z.string().optional(),
        mailboxEmail: z.string().optional().describe("כתובת תיבת Gmail מקור"),
        deleted: z.boolean().optional().describe("true=הצג נמחקים בלבד"),
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
      }),
    },
    async (args, userId) => {
      const date = dateRangeFilter(args.from as string, args.to as string);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { userId, deletedAt: args.deleted ? { not: null } : null };
      if (args.status) where.status = args.status;
      if (args.classification) where.isBusiness = args.classification === "business";
      if (typeof args.sentToAccountant === "boolean") where.sends = args.sentToAccountant ? { some: {} } : { none: {} };
      if (date) where.date = date;
      if (args.vendor) where.vendor = { contains: args.vendor as string, mode: "insensitive" };
      if (args.categoryId) where.categoryId = args.categoryId;
      if (args.mailboxEmail) where.emailAccount = { email: args.mailboxEmail };

      const limit = (args.limit as number) ?? 25;
      const offset = (args.offset as number) ?? 0;
      const [total, rows] = await Promise.all([
        prisma.invoice.count({ where }),
        prisma.invoice.findMany({
          where,
          select: INVOICE_SELECT,
          orderBy: args.deleted ? { deletedAt: "desc" } : { date: "desc" },
          take: limit,
          skip: offset,
        }),
      ]);
      return { total, limit, offset, count: rows.length, invoices: rows.map(invoiceToOutput) };
    }
  );

  // get_invoice ─────────────────────────────────────────────────────────────────
  defineTool(
    server,
    "get_invoice",
    {
      title: "פרטי חשבונית",
      description: "כל פרטי החשבונית + קישור הורדה זמני לקובץ (תקף 15 דקות) + קישור צפייה באפליקציה.",
      inputSchema: z.object({ id: z.string() }),
    },
    async (args, userId) => {
      const id = args.id as string;
      const inv = await prisma.invoice.findFirst({ where: { id, userId }, select: INVOICE_SELECT });
      if (!inv) throw new Error("חשבונית לא נמצאה");
      const base = process.env.NEXTAUTH_URL || "";
      return {
        ...invoiceToOutput(inv),
        downloadUrl: `${base}/api/mcp/files/${id}?t=${signFileLink(id, userId)}`,
        viewUrl: `${base}/invoices/pending?focus=${id}`,
      };
    }
  );

  // update_invoice ──────────────────────────────────────────────────────────────
  defineTool(
    server,
    "update_invoice",
    {
      title: "עדכון חשבונית",
      description: "עדכון סיווג (עסקי/פרטי), קטגוריה, ספק, סכום, מטבע או תאריך של חשבונית.",
      inputSchema: z.object({
        id: z.string(),
        classification: z.enum(["business", "private"]).optional(),
        categoryId: z.string().nullable().optional(),
        vendor: z.string().optional(),
        amount: z.number().optional(),
        currency: z.enum(["ILS", "USD", "EUR", "GBP"]).optional(),
        date: z.string().optional().describe("yyyy-mm-dd"),
      }),
    },
    async (args, userId) => {
      const id = args.id as string;
      const exists = await prisma.invoice.findFirst({ where: { id, userId }, select: { id: true } });
      if (!exists) throw new Error("חשבונית לא נמצאה");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {};
      if (args.classification) data.isBusiness = args.classification === "business";
      if (args.categoryId !== undefined) data.categoryId = args.categoryId;
      if (args.vendor !== undefined) data.vendor = args.vendor;
      if (args.amount !== undefined) data.amount = args.amount;
      if (args.currency) data.currency = args.currency;
      if (args.date) {
        const d = parseDay(args.date as string);
        if (d) data.date = d;
      }
      if (Object.keys(data).length === 0) throw new Error("לא סופקו שדות לעדכון");
      await prisma.invoice.update({ where: { id }, data });
      const updated = await prisma.invoice.findFirst({ where: { id, userId }, select: INVOICE_SELECT });
      return { updated: updated ? invoiceToOutput(updated) : null };
    }
  );

  // approve_invoices ────────────────────────────────────────────────────────────
  defineTool(
    server,
    "approve_invoices",
    {
      title: "אישור חשבוניות",
      description: "אישור רשימת חשבוניות (יוצר רשומת הוצאה לכל אחת, כמו אישור ידני).",
      inputSchema: z.object({ ids: z.array(z.string()).min(1) }),
    },
    async (args, userId) => {
      const ids = args.ids as string[];
      const approved: string[] = [];
      const already: string[] = [];
      const notFound: string[] = [];
      for (const id of ids) {
        const r = await approveOne(userId, id);
        if (r === "approved") approved.push(id);
        else if (r === "already") already.push(id);
        else notFound.push(id);
      }
      return { approved, alreadyApproved: already, notFound };
    }
  );

  // mark_private ────────────────────────────────────────────────────────────────
  defineTool(
    server,
    "mark_private",
    {
      title: "סימון כפרטי",
      description: "סימון רשימת חשבוניות כפרטיות (isBusiness=false), כולל ההוצאות המקושרות.",
      inputSchema: z.object({ ids: z.array(z.string()).min(1) }),
    },
    async (args, userId) => {
      const ids = args.ids as string[];
      const inv = await prisma.invoice.updateMany({ where: { id: { in: ids }, userId }, data: { isBusiness: false } });
      await prisma.expense.updateMany({ where: { invoiceId: { in: ids }, userId }, data: { isBusiness: false } });
      return { updated: inv.count };
    }
  );

  // delete_invoice (soft) ──────────────────────────────────────────────────────
  defineTool(
    server,
    "delete_invoice",
    {
      title: "מחיקת חשבונית (רכה)",
      description: 'מחיקה רכה של חשבוניות — עוברות ל"נמחקו לאחרונה" וניתנות לשחזור. לא מחיקה לצמיתות.',
      inputSchema: z.object({ ids: z.array(z.string()).min(1) }),
    },
    async (args, userId) => {
      const ids = args.ids as string[];
      const r = await prisma.invoice.updateMany({
        where: { id: { in: ids }, userId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return { deleted: r.count };
    }
  );

  // restore_invoice ─────────────────────────────────────────────────────────────
  defineTool(
    server,
    "restore_invoice",
    {
      title: "שחזור חשבונית",
      description: "שחזור חשבוניות שנמחקו (מבטל את המחיקה הרכה).",
      inputSchema: z.object({ ids: z.array(z.string()).min(1) }),
    },
    async (args, userId) => {
      const ids = args.ids as string[];
      const r = await prisma.invoice.updateMany({
        where: { id: { in: ids }, userId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      return { restored: r.count };
    }
  );

  // send_to_accountant ─────────────────────────────────────────────────────────
  defineTool(
    server,
    "send_to_accountant",
    {
      title: "שליחה לרו\"ח",
      description:
        'שליחת רשימת חשבוניות לכתובת הרו"ח שמוגדרת בהגדרות. חובה confirm=true אחרת מסרב. לא שולח שוב חשבונית שכבר נשלחה אלא אם force=true.',
      inputSchema: z.object({
        ids: z.array(z.string()).min(1),
        confirm: z.boolean().describe("חובה true כדי לשלוח בפועל"),
        force: z.boolean().optional().describe("שלח גם חשבוניות שכבר נשלחו"),
      }),
    },
    async (args, userId) => {
      if (args.confirm !== true) throw new Error("שליחה מסורבת: חובה confirm=true כדי לשלוח בפועל");

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountantEmail: true } });
      const to = user?.accountantEmail?.trim();
      if (!to) throw new Error('לא מוגדרת כתובת רו"ח בהגדרות FinDash');

      const rl = rateLimit(`send:${userId}`, 10, 60_000);
      if (!rl.ok) throw new Error(`יותר מדי שליחות. נסה שוב בעוד ${rl.retryAfterSeconds} שניות`);

      const ids = args.ids as string[];
      let toSend = ids;
      let skippedAlreadySent: string[] = [];
      if (!args.force) {
        const sent = await prisma.invoice.findMany({
          where: { id: { in: ids }, userId, sends: { some: {} } },
          select: { id: true },
        });
        skippedAlreadySent = sent.map((s) => s.id);
        const skipSet = new Set(skippedAlreadySent);
        toSend = ids.filter((id) => !skipSet.has(id));
      }
      if (toSend.length === 0) {
        return { sent: 0, to, skippedAlreadySent, note: "כל החשבוניות שנבחרו כבר נשלחו (השתמש ב-force=true לשליחה חוזרת)" };
      }

      const result = await sendInvoicesToAccountant(userId, { invoiceIds: toSend, to });
      if (!result.ok) throw new Error(result.message);
      return { sent: result.sentCount, to: result.to, from: result.from, skippedAlreadySent };
    }
  );

  // sync_mailboxes ──────────────────────────────────────────────────────────────
  defineTool(
    server,
    "sync_mailboxes",
    {
      title: "סנכרון תיבות",
      description:
        "הפעלת סנכרון חשבוניות מ-Gmail (תיבה מסוימת או הכל, טווח תאריכים אופציונלי). רץ באופן אינקרמנטלי ומחזיר סיכום: נמצאו, כפולים, שגיאות.",
      inputSchema: z.object({
        mailboxEmail: z.string().optional().describe("השאר ריק לסנכרון כל התיבות"),
        from: z.string().optional().describe("yyyy-mm-dd"),
        to: z.string().optional().describe("yyyy-mm-dd"),
      }),
    },
    async (args, userId) => {
      const accounts = await prisma.emailAccount.findMany({ where: { userId }, select: { id: true, email: true } });
      if (accounts.length === 0) throw new Error("לא מחוברות תיבות Gmail");
      const selected = args.mailboxEmail
        ? accounts.filter((a) => a.email === args.mailboxEmail)
        : accounts;
      if (selected.length === 0) throw new Error(`תיבה לא נמצאה: ${args.mailboxEmail}`);

      const afterDate = parseDay(args.from as string) ?? new Date(0);
      const toDate = parseDay(args.to as string) ?? null;
      const result = await runSync(userId, selected.map((a) => a.id), afterDate, toDate);
      return {
        found: result.totalInvoicesFound,
        duplicates: result.totalDuplicates,
        stoppedEarly: result.stoppedEarly,
        lastProcessedDate: result.lastProcessedDate ? result.lastProcessedDate.toISOString() : null,
        failedAccounts: result.failedAccounts,
      };
    }
  );

  // get_sync_status ─────────────────────────────────────────────────────────────
  defineTool(
    server,
    "get_sync_status",
    {
      title: "סטטוס סנכרון",
      description: "לכל תיבה: סנכרון מוצלח אחרון, טווחי הסנכרון האחרונים (כולל כמה נמצאו), והאם צריך חיבור מחדש.",
      inputSchema: z.object({}),
    },
    async (_args, userId) => {
      const accounts = await prisma.emailAccount.findMany({
        where: { userId },
        select: {
          email: true,
          needsReconnect: true,
          lastSyncAt: true,
          syncRanges: { orderBy: { createdAt: "desc" }, take: 5, select: { fromDate: true, toDate: true, invoicesFound: true, createdAt: true } },
        },
      });
      return {
        mailboxes: accounts.map((a) => ({
          email: a.email,
          status: a.needsReconnect ? "expired" : "connected",
          lastSyncAt: a.lastSyncAt ? a.lastSyncAt.toISOString() : null,
          recentRuns: a.syncRanges.map((r) => ({
            from: r.fromDate.toISOString().slice(0, 10),
            to: r.toDate.toISOString().slice(0, 10),
            invoicesFound: r.invoicesFound,
            at: r.createdAt.toISOString(),
          })),
        })),
      };
    }
  );

  // get_mailbox_status ──────────────────────────────────────────────────────────
  defineTool(
    server,
    "get_mailbox_status",
    {
      title: "בריאות תיבות",
      description: "לכל תיבת Gmail: מחובר/פג, סנכרון אחרון, ושגיאה אחרונה (אם יש).",
      inputSchema: z.object({}),
    },
    async (_args, userId) => {
      const accounts = await prisma.emailAccount.findMany({
        where: { userId },
        select: { email: true, needsReconnect: true, lastSyncAt: true, lastError: true, lastErrorAt: true },
      });
      return {
        mailboxes: accounts.map((a) => ({
          email: a.email,
          status: a.needsReconnect ? "expired" : "connected",
          lastSyncAt: a.lastSyncAt ? a.lastSyncAt.toISOString() : null,
          lastError: a.lastError ?? null,
          lastErrorAt: a.lastErrorAt ? a.lastErrorAt.toISOString() : null,
        })),
      };
    }
  );

  // list_categories ─────────────────────────────────────────────────────────────
  defineTool(
    server,
    "list_categories",
    {
      title: "קטגוריות",
      description: "רשימת הקטגוריות הקיימות (id, שם, צבע).",
      inputSchema: z.object({}),
    },
    async () => {
      const categories = await prisma.category.findMany({ select: { id: true, name: true, color: true }, orderBy: { name: "asc" } });
      return { categories };
    }
  );
}
