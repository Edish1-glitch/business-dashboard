import { test, expect } from "@playwright/test";

test.describe("Dashboard - Layout & RTL", () => {
  test("page loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("FinDash - ניהול פיננסי");
  });

  test("HTML has RTL direction and Hebrew lang", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("dir", "rtl");
    await expect(html).toHaveAttribute("lang", "he");
  });

  test("displays page header with title", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header h1")).toHaveText("דאשבורד");
  });
});

test.describe("Dashboard - Summary Cards", () => {
  test("displays all 6 cards (4 summary + 2 placeholder)", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator('[data-slot="card"]');
    await expect(cards).toHaveCount(6);
  });

  test("summary cards show correct titles in Hebrew", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("הוצאות החודש")).toBeVisible();
    await expect(page.getByText("הכנסות החודש")).toBeVisible();
    await expect(page.getByText("חשבוניות שנמשכו", { exact: true })).toBeVisible();
    await expect(page.getByText("כרטיסי אשראי")).toBeVisible();
  });

  test("placeholder sections are visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("הוצאות לפי קטגוריה")).toBeVisible();
    await expect(page.getByText("חשבוניות אחרונות")).toBeVisible();
  });
});

test.describe("Desktop (1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("sidebar is visible", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("sidebar contains all navigation links", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("דאשבורד")).toBeVisible();
    await expect(sidebar.getByText("חשבוניות מייל")).toBeVisible();
    await expect(sidebar.getByText("פיצול PDF")).toBeVisible();
    await expect(sidebar.getByText("חשבונית ירוקה")).toBeVisible();
    await expect(sidebar.getByText("הגדרות")).toBeVisible();
  });

  test("sidebar shows FinDash brand", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside");
    const brand = sidebar.locator("span", { hasText: "FinDash" });
    await expect(brand).toBeVisible();
  });

  test("hamburger menu is hidden", async ({ page }) => {
    await page.goto("/");
    const menuLabel = page.locator('header label[aria-label="פתח תפריט"]');
    await expect(menuLabel).toBeHidden();
  });

  test("summary cards are in a wide grid", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator('[data-slot="card"]');
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    // On desktop, first two cards should be side by side
    expect(Math.abs(second!.y - first!.y)).toBeLessThan(5);
  });

  test("clicking nav links updates URL", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside").getByText("חשבוניות מייל").click();
    await expect(page).toHaveURL(/\/invoices/);

    await page.locator("aside").getByText("פיצול PDF").click();
    await expect(page).toHaveURL(/\/pdf-split/);
  });
});

test.describe("Mobile (390x844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("sidebar is hidden", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeHidden();
  });

  test("hamburger menu is visible", async ({ page }) => {
    await page.goto("/");
    const menuLabel = page.locator('header label[aria-label="פתח תפריט"]');
    await expect(menuLabel).toBeVisible();
  });

  test("mobile menu opens and shows navigation", async ({ page }) => {
    await page.goto("/");
    await page.locator('header label[aria-label="פתח תפריט"]').click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await expect(dialog.getByText("דאשבורד")).toBeVisible();
    await expect(dialog.getByText("חשבוניות מייל")).toBeVisible();
    await expect(dialog.getByText("פיצול PDF")).toBeVisible();
    await expect(dialog.getByText("חשבונית ירוקה")).toBeVisible();
    await expect(dialog.getByText("הגדרות")).toBeVisible();
  });

  test("summary cards stack vertically", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator('[data-slot="card"]');
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    // Cards should be stacked vertically
    expect(second!.y).toBeGreaterThan(first!.y + first!.height - 5);
  });
});

test.describe("Tablet (810x1080)", () => {
  test.use({ viewport: { width: 810, height: 1080 } });

  test("sidebar is visible on tablet (md breakpoint)", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("summary cards show in 2-column grid", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator('[data-slot="card"]');
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    // On tablet (sm breakpoint), first two cards should be side by side
    expect(Math.abs(second!.y - first!.y)).toBeLessThan(5);
  });
});
