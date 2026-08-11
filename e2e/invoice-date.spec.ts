import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { mockCommon, mockInvoices, makeInvoice } from "./helpers/mocks";

// Invoice dates are stored as midnight UTC (a tz-proof calendar day). Render the
// browser in a NEGATIVE-offset timezone: if the UI ever formats the date in the
// viewer's local tz instead of UTC, a `T00:00:00Z` date rolls back to the previous
// day here — the exact off-by-one this guards against. All assertions expect the
// stored day (21), never the day-before (20).
test.use({ timezoneId: "America/New_York" });

test.beforeEach(async ({ page, context }) => {
  await login(context);
  await mockCommon(page);
});

test("approved card shows the stored calendar day, not one day earlier", async ({ page }) => {
  await mockInvoices(page, {
    approved: [makeInvoice({ status: "approved", vendor: "ספק תאריך", date: "2025-09-21T00:00:00.000Z", sends: [] })],
  });
  await page.goto("/invoices");
  await expect(page.getByText("ספק תאריך")).toBeVisible();
  await expect(page.getByText("21.9.2025")).toBeVisible();
  await expect(page.getByText("20.9.2025")).toHaveCount(0);
});

test("pending card shows the stored calendar day, not one day earlier", async ({ page }) => {
  await mockInvoices(page, {
    pending: [makeInvoice({ vendor: "ספק ממתין", date: "2025-09-21T00:00:00.000Z" })],
  });
  await page.goto("/invoices/pending");
  await expect(page.getByText("ספק ממתין")).toBeVisible();
  await expect(page.getByText("21.9.2025")).toBeVisible();
  await expect(page.getByText("20.9.2025")).toHaveCount(0);
});
