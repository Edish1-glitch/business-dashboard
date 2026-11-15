import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { mockCommon, dashboardData, json } from "./helpers/mocks";

// Stage-0 regression: a silently-expired Gmail connection must surface a red
// banner on every dashboard page (not only buried in Settings).
test("mailbox health banner appears when a Gmail account is expired", async ({ context, page }) => {
  await login(context);
  await mockCommon(page);

  // Override the common /api/settings mock: one expired sender account.
  await page.route(
    (u) => u.pathname === "/api/settings",
    (r) =>
      json(r, {
        accountantEmail: "",
        senderAccounts: [{ id: "a1", email: "edishteinberg10@gmail.com", needsReconnect: true }],
      })
  );
  await page.route((u) => u.pathname === "/api/dashboard", (r) => json(r, dashboardData));

  await page.goto("/");

  const banner = page.getByText("החיבור ל-Gmail פג");
  await expect(banner).toBeVisible();
  // Links to the reconnect flow.
  await expect(page.locator('a[href="/api/email-accounts/connect"]').first()).toBeVisible();

  await page.screenshot({ path: "test-results/banner-mobile.png" });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(banner).toBeVisible();
  await page.screenshot({ path: "test-results/banner-desktop.png" });
});

// And it must NOT appear when all accounts are healthy.
test("no banner when all Gmail accounts are healthy", async ({ context, page }) => {
  await login(context);
  await mockCommon(page); // default /api/settings → senderAccounts: []
  await page.route((u) => u.pathname === "/api/dashboard", (r) => json(r, dashboardData));

  await page.goto("/");
  await expect(page.getByText("החיבור ל-Gmail פג")).toHaveCount(0);
});
