import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { mockCommon, mockInvoices, makeInvoice } from "./helpers/mocks";

test.beforeEach(async ({ page, context }) => {
  await login(context);
  await mockCommon(page);
});

test("renders the list with a centered title", async ({ page }) => {
  await mockInvoices(page, {
    pending: [makeInvoice({ vendor: "ספק אלפא" }), makeInvoice({ vendor: "ספק ביתא", amount: 25.6 })],
  });
  await page.goto("/invoices/pending");
  await expect(page.getByRole("heading", { name: "ממתינות לאישור" })).toBeVisible();
  await expect(page.getByText("ספק אלפא")).toBeVisible();
  await expect(page.getByText("ספק ביתא")).toBeVisible();
});

test("advanced filter sheet opens and closes", async ({ page }) => {
  await mockInvoices(page, { pending: [makeInvoice()] });
  await page.goto("/invoices/pending");
  await page.getByRole("button", { name: "מיון וסינון" }).click();
  await expect(page.getByText("סינון מתקדם")).toBeVisible();
  await expect(page.getByText("טווח תאריכים")).toBeVisible();
  await page.getByRole("button", { name: /הצג/ }).click();
  await expect(page.getByText("סינון מתקדם")).toBeHidden();
});

test("'בחר' enters multi-select mode", async ({ page }) => {
  await mockInvoices(page, { pending: [makeInvoice(), makeInvoice()] });
  await page.goto("/invoices/pending");
  await page.getByRole("button", { name: "בחר", exact: true }).click();
  await expect(page.getByText(/נבחרו/)).toBeVisible();
});

test("'פרטי' requires a second tap to confirm", async ({ page }) => {
  await mockInvoices(page, { pending: [makeInvoice({ vendor: "ספק בדיקה", isBusiness: true })] });
  await page.goto("/invoices/pending");
  await page.getByText("ספק בדיקה").click(); // open the focused card
  await page.getByRole("button", { name: "פרטי", exact: true }).click(); // first tap
  await expect(page.getByRole("button", { name: "בטוח?" })).toBeVisible();
});

test("deleting asks for confirmation", async ({ page }) => {
  await mockInvoices(page, { pending: [makeInvoice({ vendor: "ספק למחיקה" })] });
  await page.goto("/invoices/pending");
  await page.getByText("ספק למחיקה").click(); // focused
  await page.getByRole("button", { name: "ערוך" }).click(); // edit view
  await page.getByRole("button", { name: "מחק" }).click(); // opens confirm
  await expect(page.getByText("למחוק את החשבונית?")).toBeVisible();
});
