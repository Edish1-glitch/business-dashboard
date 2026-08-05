import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { mockCommon, mockInvoices, makeInvoice, json } from "./helpers/mocks";

test.beforeEach(async ({ page, context }) => {
  await login(context);
  await mockCommon(page);
});

test("shows deleted invoices with a countdown + permanent-delete confirm", async ({ page }) => {
  await mockInvoices(page, {
    deleted: [makeInvoice({ status: "approved", vendor: "ספק שנמחק", deletedAt: new Date().toISOString() })],
  });
  await page.goto("/invoices/deleted");
  await expect(page.getByRole("heading", { name: "נמחקו לאחרונה" })).toBeVisible();
  await expect(page.getByText("ספק שנמחק")).toBeVisible();
  await expect(page.getByText(/יימחק בעוד/)).toBeVisible();
  await page.getByRole("button", { name: "מחק לצמיתות" }).click();
  await expect(page.getByText("למחוק לצמיתות?")).toBeVisible();
});

test("restore calls the restore endpoint and removes the row", async ({ page }) => {
  await mockInvoices(page, {
    deleted: [makeInvoice({ id: "del-1", vendor: "לשחזור", deletedAt: new Date().toISOString() })],
  });
  let restoreCalled = false;
  await page.route((u) => u.pathname === "/api/invoices/del-1/restore", (r) => {
    restoreCalled = true;
    return json(r, { success: true });
  });
  await page.goto("/invoices/deleted");
  await page.getByRole("button", { name: "שחזר" }).click();
  await expect.poll(() => restoreCalled).toBe(true);
  await expect(page.getByText("לשחזור")).toBeHidden();
});

test("empty trash shows the empty state", async ({ page }) => {
  await mockInvoices(page, { deleted: [] });
  await page.goto("/invoices/deleted");
  await expect(page.getByText("אין חשבוניות שנמחקו")).toBeVisible();
});
