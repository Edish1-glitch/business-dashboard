import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { mockCommon, dashboardData, json } from "./helpers/mocks";

test.describe("smoke", () => {
  test("redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto("/invoices/pending");
    await expect(page).toHaveURL(/\/login/);
  });

  test("authenticated dashboard loads with the brand header + total", async ({ page, context }) => {
    await login(context);
    await mockCommon(page);
    await page.route((u) => u.pathname === "/api/dashboard", (r) => json(r, dashboardData));

    await page.goto("/");
    // Brand shown in the header (banner)
    await expect(page.getByRole("banner").getByText("FinDash", { exact: true })).toBeVisible();
    // Total expenses hero (exact, unrounded)
    await expect(page.getByText("₪2,745.4").first()).toBeVisible();
    // Category legend rendered
    await expect(page.getByText("הוצאות לפי קטגוריה")).toBeVisible();
  });
});
