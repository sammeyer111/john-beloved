const { test, expect } = require("@playwright/test");

test("page loads and has an H1", async ({ page }, testInfo) => {
  await page.goto("/");

  const h1 = page.locator("h1");
  const header = page.locator("header");
  const nav = page.locator("nav");
  const button = page.locator("button");
  await expect(h1).toBeVisible();
  await expect(header).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(button).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("homepage_h1.png"),
    fullPage: true,
  });
});
