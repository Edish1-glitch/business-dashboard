import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { mockCommon, mockInvoices, makeInvoice } from "./helpers/mocks";

// The side-by-side detail/editor is a desktop-only (lg+) layout.
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page, context }) => {
  await login(context);
  await mockCommon(page);
});

test("pending: clicking a card opens the editor directly (desktop)", async ({ page }) => {
  await mockInvoices(page, { pending: [makeInvoice({ vendor: "ספק דסקטופ" })] });
  await page.goto("/invoices/pending");
  await page.getByText("ספק דסקטופ").click();
  // The spacious editor is shown straight away — no intermediate action buttons.
  await expect(page.getByRole("button", { name: "אשר ושמור" })).toBeVisible();
  await expect(page.getByRole("button", { name: "שמור בלבד" })).toBeVisible();
});

test("approved: clicking a card opens the side-by-side details pane (desktop)", async ({ page }) => {
  await mockInvoices(page, {
    approved: [makeInvoice({ status: "approved", vendor: "ספק מאושר דסק", isBusiness: true, sends: [] })],
  });
  await page.goto("/invoices");
  await page.getByText("ספק מאושר דסק").click();
  // The desktop pane exposes the reclassify control (business → private).
  await expect(page.getByRole("button", { name: "שנה להוצאה פרטית" }).filter({ visible: true })).toBeVisible();
});
