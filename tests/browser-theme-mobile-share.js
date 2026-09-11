const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const navigate = async (view) => {
    await page.locator("#openSelection").click();
    await page.locator(".primary-nav").waitFor({ state: "visible" });
    await page.locator(`[data-view="${view}"]`).click();
  };

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });

  await navigate("themes");
  assert.equal(await page.locator("#themeGuideDialog").count(), 0);
  assert.equal(await page.getByText(/20\s*道题|逐题填写/).count(), 0);
  assert.equal(await page.locator(".theme-matrix-heading").count(), 0);
  assert.equal(await page.getByText("等待选择", { exact: true }).count(), 0);
  assert.equal(await page.locator(".theme-single-card > small").count(), 0);
  assert.ok((await page.locator(".theme-single-card").first().evaluate((node) => getComputedStyle(node).backgroundImage)).includes("linear-gradient"));
  await page.locator(".theme-single-card").first().hover();
  assert.notEqual(await page.locator(".theme-single-card").first().evaluate((node) => getComputedStyle(node).transform), "none");
  await page.locator("#themeSearchInput").fill("少女乐队的呐喊");
  await page.locator("[data-theme-toggle]").first().click();
  assert.equal(await page.locator("#themeItemCount").textContent(), "1");

  await page.locator("#openShareStudio").click();
  assert.equal(await page.locator("#shareWatermark").count(), 0);
  assert.equal(await page.locator("#shareIncludeAnnual").count(), 0);
  await page.locator("#generateShareImages").click();
  await page.locator(".share-preview-item").first().waitFor({ state: "visible", timeout: 60000 });
  assert.equal(await page.locator(".share-preview-item").count(), 4);
  const previewDimensions = await page.locator(".share-preview-item img").first().evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }));
  assert.deepEqual(previewDimensions, { width: 1080, height: 1440 });
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-download-share]").first().click();
  const download = await downloadPromise;
  await download.saveAs("tests/theme-share-page-1.png");
  await page.locator("#shareDialog").screenshot({ path: "tests/theme-share-preview.png" });

  await page.locator("#shareShowEmpty").uncheck();
  await page.locator('input[name="shareTemplate"][value="story"]').check();
  await page.locator("#generateShareImages").click();
  await page.waitForFunction(() => document.querySelector("#shareStatus")?.textContent.startsWith("已生成"));
  assert.deepEqual(await page.locator(".share-preview-item img").first().evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight })), { width: 1080, height: 1920 });

  await page.locator("#shareShowEmpty").check();
  await page.locator('input[name="shareTemplate"][value="long"]').check();
  await page.locator("#generateShareImages").click();
  await page.waitForFunction(() => document.querySelector("#shareStatus")?.textContent.startsWith("已生成"));
  const longDimensions = await page.locator(".share-preview-item img").first().evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }));
  assert.equal(longDimensions.width, 1080);
  assert.ok(longDimensions.height > 4000);
  await page.locator("#closeShareDialog").click();

  await page.locator("#clearThemes").click();
  await page.locator("#confirmClearDialog").waitFor({ state: "visible" });
  await page.locator("#cancelClearAction").click();
  assert.equal(await page.locator("#themeItemCount").textContent(), "1");
  await page.locator("#clearThemes").click();
  await page.locator("#confirmClearAction").click();
  assert.equal(await page.locator("#themeItemCount").textContent(), "0");

  await page.setViewportSize({ width: 390, height: 844 });
  await navigate("browse");
  const mobilePosterGrid = await page.locator("#posterGrid").evaluate((node) => ({
    columns: getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length,
    cardWidth: node.querySelector(".poster-card")?.getBoundingClientRect().width || 0,
  }));
  assert.equal(mobilePosterGrid.columns, 3);
  assert.ok(mobilePosterGrid.cardWidth < 140);
  const mobileNavBox = await page.locator(".primary-nav").boundingBox();
  assert.ok(mobileNavBox.y >= 55 && mobileNavBox.y < 90, `mobile nav should slide from the header, got y=${mobileNavBox.y}`);
  assert.equal(await page.locator("#mobileFilterToggle").isVisible(), true);
  assert.equal(await page.locator(".filter-panel .filter-row").isVisible(), false);
  await page.locator("#mobileFilterToggle").click();
  assert.equal(await page.locator(".filter-panel .filter-row").isVisible(), true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "tests/first-visit-mobile-preview.png" });
  await navigate("themes");
  assert.equal(await page.locator("#themeGuideDialog").count(), 0);
  assert.equal(await page.locator("#themeSearchInput").isVisible(), true);
  await page.locator(".theme-matrix-shell").screenshot({ path: "tests/theme-profile-mobile-preview.png" });
  await page.waitForTimeout(120);
  const themeDragSource = page.locator(".theme-single-card").nth(1);
  const themeDragTarget = page.locator(".theme-single-card").first();
  const themeDragSourceId = await themeDragSource.getAttribute("data-theme-id");
  const themeDragTargetId = await themeDragTarget.getAttribute("data-theme-id");
  const themeDragSourceBox = await themeDragSource.boundingBox();
  const themeDragTargetBox = await themeDragTarget.boundingBox();
  await themeDragSource.dispatchEvent("pointerdown", { pointerId: 301, pointerType: "touch", button: 0, clientX: themeDragSourceBox.x + 20, clientY: themeDragSourceBox.y + 20, bubbles: true });
  await page.waitForTimeout(520);
  await page.locator("#themeMatrix").dispatchEvent("pointermove", { pointerId: 301, pointerType: "touch", button: 0, clientX: themeDragTargetBox.x + 20, clientY: themeDragTargetBox.y + 20, bubbles: true });
  await page.locator("#themeMatrix").dispatchEvent("pointerup", { pointerId: 301, pointerType: "touch", button: 0, clientX: themeDragTargetBox.x + 20, clientY: themeDragTargetBox.y + 20, bubbles: true });
  assert.equal(await page.locator(".theme-single-card").first().getAttribute("data-theme-id"), themeDragSourceId);
  assert.equal(await page.locator(".theme-single-card").nth(1).getAttribute("data-theme-id"), themeDragTargetId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await navigate("themes");
  assert.equal(await page.locator(".theme-single-card").first().getAttribute("data-theme-id"), themeDragSourceId);

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("Theme matrix editor and PNG share export test passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
