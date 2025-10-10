const { test, expect } = require("@playwright/test");
test("page loads and has an H1", async ({ page }, testInfo) => {
  await page.goto("/");

  //assert one visible H1 exists
  const h1 = page.locator("h1");
  await expect(h1).toBeVisible();

  const header = page.locator("header");
  const nav = page.locator("nav");
  const main = page.locator("main");

  await expect(header).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(main).toBeVisible();

  //Single screenshot
  await page.screenshot({ path: testInfo.outputPath("homepage_h1.png"), fullPage: true });
});
