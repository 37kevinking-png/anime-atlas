const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(20000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const navigate = async (view) => {
    await page.locator("#openSelection").click();
    await page.locator(".primary-nav").waitFor({ state: "visible" });
    await page.locator(`[data-view="${view}"]`).click();
  };

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await navigate("browse");
  await page.locator("#browseView").waitFor({ state: "visible" });

  const chineseMeta = await page.evaluate(() => window.ANIME_CN_DATA_META);
  assert.equal(chineseMeta.records, 5384);
  assert.equal(chineseMeta.all_tags_preserved, true);
  assert.equal(await page.evaluate(() => window.ANIME_CN_DATA.find((item) => item.title === "葫芦兄弟")?.year), 1986);
  assert.equal(await page.evaluate(() => window.ANIME_CN_DATA.some((item) => "bangumiAllTags" in item)), false);
  assert.ok(await page.evaluate(() => window.ANIME_CN_DATA.find((item) => item.title === "葫芦兄弟")?.chineseCategoryKey));

  const releaseStats = await page.evaluate(() => {
    const now = new Date();
    const released = (item) => {
      const match = String(item.releaseDate || "").match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
      const year = match ? Number(match[1]) : item.year;
      if (!Number.isInteger(year)) return true;
      if (year !== now.getFullYear()) return year < now.getFullYear();
      if (!match?.[2]) return true;
      const month = Number(match[2]);
      if (month !== now.getMonth() + 1) return month < now.getMonth() + 1;
      if (!match[3]) return true;
      return Number(match[3]) <= now.getDate();
    };
    const visible = window.ANIME_CN_DATA.filter(released);
    return {
      visible: visible.length,
      undated: visible.filter((item) => !Number.isInteger(item.year)).length,
      nineties: visible.filter((item) => item.year >= 1990 && item.year <= 1999).length,
      future: window.ANIME_CN_DATA.length - visible.length,
      currentYear: now.getFullYear(),
    };
  });

  await page.locator('[data-origin="cn"]').click();
  assert.equal(await page.locator('[data-origin="cn"]').getAttribute("aria-selected"), "true");
  assert.equal(Number((await page.locator("#catalogCount").textContent()).replaceAll(",", "")), releaseStats.visible);
  assert.ok(releaseStats.future > 0);
  assert.equal(await page.locator("#typeFilterGroup").isVisible(), true);
  assert.equal(await page.locator("#typeFilters [data-type]").count(), 5);
  assert.equal((await page.locator('#typeFilters [data-type="cn-tv"]').textContent()).trim(), "TV动画");
  assert.equal(await page.locator("#lowVoteToggle").isChecked(), false);
  assert.equal(await page.locator('[data-period="all"]').count(), 1);
  assert.equal(await page.locator('[data-period="1990s"]').count(), 1);
  assert.equal(Number(await page.locator('[data-period="1990s"] small').textContent()), releaseStats.nineties);
  assert.equal(await page.locator('[data-period="1990"]').count(), 0);
  assert.equal(await page.locator('[data-period="1999"]').count(), 0);
  assert.equal(await page.locator(`[data-period="${releaseStats.currentYear + 1}"]`).count(), 0);
  assert.equal(Number(await page.locator('[data-period="undated"] small').textContent()), releaseStats.undated);
  await page.locator('[data-period="1990s"]').click();
  assert.equal(Number((await page.locator("#resultCount").textContent()).replaceAll(",", "")), releaseStats.nineties);
  await page.locator("#originSwitchShell").screenshot({ path: "tests/origin-switch-preview.png" });

  await page.locator("#searchInput").fill("葫芦兄弟");
  const targetCard = page.locator(".poster-card").filter({ has: page.getByRole("heading", { name: "葫芦兄弟", exact: true }) });
  assert.equal(await targetCard.count(), 1);
  assert.ok((await targetCard.textContent()).includes("TV动画"));
  assert.ok((await targetCard.textContent()).includes("原始平台 TV"));
  assert.ok((await targetCard.locator(".anime-title-link").getAttribute("href")).includes("bgm.tv/subject/"));
  assert.equal(await targetCard.locator(".selection-indicator, .theme-menu-button, .card-footer").count(), 0);

  await page.locator("#searchInput").fill("");
  await page.locator('[data-period="all"]').click();
  await page.locator('[data-type="cn-tv"]').click();
  assert.ok(Number((await page.locator("#resultCount").textContent()).replaceAll(",", "")) >= 1);
  await page.locator('[data-type="cn-web"]').click();
  assert.equal(await page.locator('#posterGrid .anime-tags span', { hasText: /^WEB(?:\s|$)/i }).count(), 0);
  assert.ok(Number((await page.locator("#resultCount").textContent()).replaceAll(",", "")) >= 1);
  await page.locator('[data-type="cn-movie"]').click();
  assert.ok(Number((await page.locator("#resultCount").textContent()).replaceAll(",", "")) >= 1);
  await page.locator('[data-type="all"]').click();
  await page.locator("#searchInput").fill("葫芦兄弟");

  await targetCard.click({ button: "right" });
  assert.equal(await page.locator("#themeQuickMenu").isVisible(), true);
  assert.equal((await page.locator("#themeQuickMenu button").first().textContent()).trim().startsWith("✓看过"), true);
  assert.equal(await page.locator("[data-quick-reaction]").count(), 3);
  assert.equal(await page.locator("[data-quick-theme]").count(), 21);
  assert.ok((await page.locator('[data-quick-theme="annual"] small').textContent()).includes("1986"));
  await page.screenshot({ path: "tests/chinese-catalog-preview.png", fullPage: false });
  await page.locator('[data-quick-reaction="watched"]').click();
  assert.deepEqual(await page.evaluate(() => {
    const [item] = JSON.parse(localStorage.getItem("anime-atlas:collection:v1"));
    return { count: JSON.parse(localStorage.getItem("anime-atlas:collection:v1")).length, reaction: item.reaction };
  }), { count: 1, reaction: "watched" });
  await targetCard.click({ button: "right" });
  await page.locator('[data-quick-theme="favorites"]').click();
  assert.equal(await page.evaluate(() => {
    const lists = JSON.parse(localStorage.getItem("anime-atlas:theme-lists:v1"));
    return lists.find((list) => list.id === "favorites").records.length;
  }), 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("anime-atlas:collection:v1")).length), 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await targetCard.dispatchEvent("pointerdown", { pointerId: 41, pointerType: "touch", clientX: 120, clientY: 220, bubbles: true });
  await page.waitForTimeout(600);
  assert.equal(await page.locator("#themeQuickMenu").isVisible(), true);
  await page.locator("body").click({ position: { x: 4, y: 4 } });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await navigate("collection");
  assert.equal(await page.locator(".memory-card").count(), 1);
  await page.locator(".memory-card").click({ button: "right" });
  await page.screenshot({ path: "tests/context-menu-preview.png", fullPage: false });
  await page.locator('[data-quick-reaction="recommended"]').click();
  assert.equal(await page.locator(".memory-card .reaction-title--recommended").count(), 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("anime-atlas:collection:v1"))[0].reaction), "recommended");
  await page.reload({ waitUntil: "domcontentloaded" });
  await navigate("collection");
  assert.equal(await page.locator(".memory-card .reaction-title--recommended").count(), 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("anime-atlas:theme-lists:v1")).find((list) => list.id === "recommend").records.length), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  const overviewLabels = page.locator(".overview-types small");
  assert.equal(await overviewLabels.count(), 5);
  assert.equal(await overviewLabels.evaluateAll((labels) => labels.every((label) => label.scrollWidth <= label.clientWidth)), true);
  await page.locator(".collection-overview").screenshot({ path: "tests/collection-overview-mobile-latest.png" });
  await page.locator(".memory-card").scrollIntoViewIfNeeded();
  const memoryCardBox = await page.locator(".memory-card").boundingBox();
  await page.locator(".memory-card").dispatchEvent("pointerdown", { pointerId: 73, pointerType: "touch", clientX: memoryCardBox.x + 40, clientY: memoryCardBox.y + 40, bubbles: true });
  await page.waitForTimeout(600);
  assert.equal(await page.locator("#themeQuickMenu").isVisible(), true);
  await page.locator('[data-quick-reaction="difficult"]').click();
  assert.equal(await page.locator(".memory-card .reaction-title--difficult").count(), 1);
  await page.locator(".memory-card").click({ button: "right" });
  await page.locator('[data-quick-reaction="recommended"]').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator(".memory-card").click({ button: "right" });
  await page.locator('[data-quick-theme="recommend"]').click();
  assert.equal(await page.evaluate(() => {
    const lists = JSON.parse(localStorage.getItem("anime-atlas:theme-lists:v1"));
    return lists.find((list) => list.id === "recommend").records.length;
  }), 1);
  assert.deepEqual(pageErrors, []);
  await browser.close();
  console.log("Chinese catalog and right-click theme menu test passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
