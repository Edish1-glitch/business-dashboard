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
    await expect(page.getByText("סיור באפליקציה")).toBeVisible();
    await expect(page.getByText("דאשבורד ראשי")).toBeVisible();
  });

  test("tour has 4 steps with navigation", async ({ page }) => {
    await page.goto("/tour");
    // Step 1
    await expect(page.getByText("דאשבורד ראשי")).toBeVisible();
    await expect(page.getByText("1/4")).toBeVisible();

    // Navigate to step 2
    await page.getByText("הבא").click();
    await expect(page.getByText("העלאת חשבוניות")).toBeVisible();
    await expect(page.getByText("2/4")).toBeVisible();

    // Navigate to step 3
    await page.getByText("הבא").click();
    await expect(page.getByText("אישור חשבוניות")).toBeVisible();

    // Navigate to step 4
    await page.getByText("הבא").click();
    await expect(page.getByText("ניהול וייצוא")).toBeVisible();
    await expect(page.getByText("מוכן? התחבר עכשיו")).toBeVisible();
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
