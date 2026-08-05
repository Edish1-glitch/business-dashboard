import { test, expect } from "@playwright/test";

test.describe("Auth & Login", () => {
  test("unauthenticated user redirects to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page loads with correct elements", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("FinDash - ניהול פיננסי");
    await expect(page.getByText("FinDash")).toBeVisible();
    await expect(page.getByText("התחבר עם Google")).toBeVisible();
    await expect(page.getByText("סיור באפליקציה")).toBeVisible();
  });

  test("login page has RTL direction", async ({ page }) => {
    await page.goto("/login");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "he");
  });
});

test.describe("Tour Page", () => {
  test("tour page loads without auth", async ({ page }) => {
    await page.goto("/tour");
    await expect(page.getByText("סיור מודרך")).toBeVisible();
    await expect(page.getByText("ברוך הבא ל-FinDash")).toBeVisible();
  });

  test("tour steps navigate through all 8 slides", async ({ page }) => {
    await page.goto("/tour");
    await expect(page.getByText("ברוך הבא ל-FinDash")).toBeVisible();
    await expect(page.getByText("1/8")).toBeVisible();

    await page.getByRole("button", { name: "הבא" }).click();
    await expect(page.getByText("חבר את ה-Gmail")).toBeVisible();
    await expect(page.getByText("2/8")).toBeVisible();

    // Advance to the last (8th) slide and confirm the finish button
    for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "הבא" }).click();
    await expect(page.getByText("מאובטח ומחובר")).toBeVisible();
    await expect(page.getByRole("button", { name: /יאללה/ })).toBeVisible();
  });
});

test.describe("API Protection", () => {
  test("invoices API requires auth", async ({ page }) => {
    await page.goto("/api/invoices?status=pending");
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("categories API requires auth", async ({ page }) => {
    await page.goto("/api/categories");
    await expect(page).toHaveURL(/\/login/);
  });

  // Regression guard for the IDOR fix: per-invoice file routes must be gated.
  test("per-invoice file/mutation routes require auth", async ({ page }) => {
    for (const path of [
      "/api/invoices/any-id/download",
      "/api/invoices/any-id/preview",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("auth providers endpoint works", async ({ page }) => {
    const res = await page.request.get("/api/auth/providers");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.google).toBeTruthy();
  });
});

test.describe("Responsive - Login Page", () => {
  test.describe("Mobile (390x844)", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("login page is responsive on mobile", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByText("FinDash")).toBeVisible();
      await expect(page.getByText("התחבר עם Google")).toBeVisible();
    });
  });

  test.describe("Desktop (1440x900)", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("login page is responsive on desktop", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByText("FinDash")).toBeVisible();
      await expect(page.getByText("התחבר עם Google")).toBeVisible();
    });
  });
});
