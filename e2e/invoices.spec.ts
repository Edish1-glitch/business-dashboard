import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { mockCommon, mockInvoices, makeInvoice } from "./helpers/mocks";

test.beforeEach(async ({ page, context }) => {
  await login(context);
  await mockCommon(page);
});

test("renders approved invoices with a centered title", async ({ page }) => {
  await mockInvoices(page, {
    approved: [makeInvoice({ status: "approved", vendor: "ספק מאושר", sends: [] })],
  });
  await page.goto("/invoices");
  await expect(page.getByRole("heading", { name: "חשבוניות מאושרות" })).toBeVisible();
  await expect(page.getByText("ספק מאושר")).toBeVisible();
});

test("selection bar exposes CSV, send and download for the selected", async ({ page }) => {
  await mockInvoices(page, {
    approved: [makeInvoice({ status: "approved", vendor: "ספק לבחירה", sends: [] })],
  });
  await page.goto("/invoices");
  await page.getByRole("button", { name: "בחר", exact: true }).click();
  await page.getByText("ספק לבחירה").click(); // toggle-select the card
  await expect(page.getByRole("button", { name: "ייצוא CSV" })).toBeVisible();
  await expect(page.getByRole("button", { name: "שלח", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "הורד" })).toBeVisible();
});

test("private invoices can't be picked for bulk send", async ({ page }) => {
  await mockInvoices(page, {
    approved: [
      makeInvoice({ status: "approved", vendor: "ספק עסקי", isBusiness: true, sends: [] }),
      makeInvoice({ status: "approved", vendor: "ספק פרטי", isBusiness: false, sends: [] }),
    ],
  });
  await page.goto("/invoices");
  await page.getByRole("button", { name: "בחר", exact: true }).click();
  // Select-all picks only the business invoice, not the private one.
  await page.getByRole("button", { name: "בחר הכל", exact: true }).click();
  await expect(page.getByText("1 נבחרו")).toBeVisible();
  // Tapping the private row does nothing — it stays unselectable.
  await page.getByText("ספק פרטי").click();
  await expect(page.getByText("1 נבחרו")).toBeVisible();
});
