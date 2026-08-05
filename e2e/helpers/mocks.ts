import type { Page, Route } from "@playwright/test";

type AnyObj = Record<string, unknown>;

export function makeInvoice(over: AnyObj = {}): AnyObj {
  return {
    id: "inv-" + Math.random().toString(36).slice(2, 9),
    fileName: "receipt.pdf",
    vendor: "פז קמעונאות ואנרגיה בע\"מ",
    amount: 77.46,
    currency: "ILS",
    date: "2025-09-21",
    status: "pending",
    isBusiness: true,
    creditCardLast4: null,
    category: { id: "c1", name: "דלק", color: "#f97316" },
    emailAccount: null,
    createdAt: "2025-09-21T00:00:00.000Z",
    deletedAt: null,
    sends: [],
    ...over,
  };
}

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

// Mock the always-on endpoints (header bell, bottom-nav badge, providers) so no
// page depends on the DB/Gmail. Preview requests return a 1x1 transparent PNG.
export async function mockCommon(page: Page) {
  await page.route((u) => u.pathname === "/api/pending-count", (r) => json(r, { count: 3 }));
  await page.route((u) => u.pathname === "/api/categories", (r) =>
    json(r, { categories: [{ id: "c1", name: "דלק", color: "#f97316" }, { id: "c2", name: "תוכנה", color: "#0ea5e9" }] })
  );
  await page.route((u) => u.pathname === "/api/notifications", (r) => json(r, { notifications: [], unread: 0 }));
  await page.route((u) => u.pathname === "/api/settings", (r) => json(r, { accountantEmail: "", senderAccounts: [] }));
  await page.route((u) => u.pathname === "/api/devices", (r) => json(r, { devices: [] }));
  await page.route((u) => u.pathname.startsWith("/api/push/"), (r) => json(r, { ok: true }));
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  );
  await page.route((u) => u.pathname.includes("/preview"), (r) => r.fulfill({ status: 200, contentType: "image/png", body: png }));
}

export const dashboardData = {
  summary: { totalExpenses: 2745.4, businessExpenses: 2000, privateExpenses: 745.4, approvedCount: 52, pendingCount: 3, creditCardCount: 0 },
  byCategory: [
    { name: "דלק", amount: 2000, color: "#f97316" },
    { name: "תוכנה", amount: 745.4, color: "#0ea5e9" },
  ],
  monthlyData: [{ month: "ספט 25", amount: 2745.4 }],
  recentInvoices: [],
};

// Mock GET /api/invoices, branching on the query (?status= / ?deleted=true).
export async function mockInvoices(
  page: Page,
  lists: { pending?: AnyObj[]; approved?: AnyObj[]; deleted?: AnyObj[] } = {}
) {
  const { pending = [], approved = [], deleted = [] } = lists;
  await page.route((u) => u.pathname === "/api/invoices", (route) => {
    const sp = new URL(route.request().url()).searchParams;
    if (sp.get("deleted") === "true") return json(route, { invoices: deleted });
    if (sp.get("status") === "approved") return json(route, { invoices: approved });
    return json(route, { invoices: pending });
  });
}

export { json };
