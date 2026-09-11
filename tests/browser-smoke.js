const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(15000);
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
  const currentYear = new Date().getFullYear();
  assert.equal(await page.evaluate((year) => window.ANIME_DATA.every((item) => !Number.isInteger(item.year) || item.year <= year), currentYear), true);
  assert.equal(await page.evaluate((year) => window.ANIME_CN_DATA.every((item) => !Number.isInteger(item.year) || item.year <= year), currentYear), true);
  await navigate("browse");
  await page.locator("#browseView").waitFor({ state: "visible" });

  const catalogCount = await page.evaluate(() => window.ANIME_DATA.length);
  const visibleCount = Number(await page.locator("#resultCount").textContent());
  assert.equal(Number((await page.locator("#catalogCount").textContent()).replaceAll(",", "")), catalogCount);
  assert.ok(catalogCount > 0);
  assert.ok(await page.evaluate(() => window.ANIME_DATA.filter((item) => item.type === "other").length > 2000));
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "少女乐队的呐喊")?.type), "tv");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "我独自升级 第二季 -起于暗影-")?.type), "tv");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "天气之子")?.type), "movie");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "企鹅公路")?.type), "movie");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "红猪")?.type), "movie");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "网球甜心 剧场版")?.type), "theatrical");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "阿拉蕾 hello!不可思议岛")?.type), "theatrical");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "阿拉蕾 哦呦呦！环球大比赛")?.type), "theatrical");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "鬼灭之刃 上弦集结、前往锻刀村")?.type), "other");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "鬼灭之刃 上弦集结、前往锻刀村")?.isCompilation), true);
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "偶像大师 百万现场! 第1幕")?.type), "theatrical");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "偶像大师 闪耀色彩 第2章")?.type), "theatrical");
  assert.equal(await page.evaluate(() => window.ANIME_DATA.some((item) => item.title === "瓮中捉鳖")), false);
  assert.equal(await page.evaluate(() => window.ANIME_DATA.some((item) => item.title === "忍者蝙蝠侠")), true);
  assert.deepEqual(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "网球甜心 剧场版")?.bangumiTags.map((tag) => tag.name)), ["剧场版", "漫画改"]);
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "动物新世代")?.bangumiTags.find((tag) => tag.name === "TV")?.count), 584);
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.title === "阿拉蕾 hello!不可思议岛")?.bangumiTags.find((tag) => tag.name === "漫画改")?.count), null);
  assert.equal(await page.evaluate(() => window.ANIME_DATA.some((item) => item.bangumiTags?.some((tag) => tag.name === "日本"))), false);
  assert.equal(await page.locator('[data-period="1990s"]').count(), 0);
  assert.equal(await page.locator('[data-period="pre1950"]').count(), 1);
  assert.equal(await page.locator('[data-period="1950s"]').count(), 1);
  assert.ok(Number(await page.locator('[data-period="pre1950"] small').textContent()) > 0);
  assert.equal(await page.locator('[data-period="1990"]').count(), 1);
  assert.ok(visibleCount > 0);
  assert.equal(await page.locator("#lowVoteToggle").isChecked(), true);
  assert.equal(await page.locator("#compilationToggle").isChecked(), true);
  assert.equal(await page.locator("#sortSelect").inputValue(), "votes");
  assert.equal(await page.locator("#sortDirection").inputValue(), "desc");
  assert.equal(await page.locator('#sortSelect option[value="score"]').textContent(), "bangumi评分");
  assert.ok((await page.locator("#homeBrand").textContent()).includes("番迹"));
  assert.equal((await page.locator("#homeBrand").textContent()).includes("刷刷刷"), false);
  assert.equal((await page.locator('.nav-button[data-view="browse"]').textContent()).trim(), "动画库");
  assert.equal((await page.locator('#typeFilters [data-type="tv"]').textContent()).trim(), "TV动画");
  assert.deepEqual(await page.locator("#sortDirection option").allTextContents(), ["倒序", "正序"]);
  assert.equal(await page.locator("#catalogTypeStats span").count(), 5);
  assert.equal(await page.locator("#selectedTypeStats span").count(), 5);
  assert.equal(await page.locator(".poster-card").count(), visibleCount);
  assert.equal(await page.locator("#posterGrid .type-badge").count(), visibleCount);
  assert.equal(await page.locator("#posterGrid .reaction-button--watched").count(), 0);
  assert.equal(await page.locator("#posterGrid .reaction-button").count(), 0);
  assert.equal(await page.locator("#posterGrid .selection-indicator").count(), 0);
  assert.equal(await page.locator("#posterGrid .theme-menu-button").count(), 0);
  assert.equal(await page.locator("#posterGrid .card-footer").count(), 0);
  assert.ok(await page.locator(".card-meta-row").count() > 0);
  assert.ok(await page.locator("#posterGrid .anime-tags").count() > 0);
  assert.equal(await page.locator("#posterGrid .source-links").count(), 0);
  assert.ok((await page.locator("#posterGrid .anime-title-link").first().getAttribute("href")).includes("bgm.tv/subject/"));

  await page.locator("#searchInput").fill("OVA 无限滑板 EXTRA PART");
  const ordinaryTagCard = page.locator(".poster-card").filter({ hasText: "OVA 无限滑板 EXTRA PART" }).first();
  assert.equal(await ordinaryTagCard.count(), 1);
  const displayedTags = await ordinaryTagCard.locator(".anime-tags span").allTextContents();
  assert.equal(displayedTags.includes("OVA"), false);
  assert.equal(displayedTags.includes("原创"), true);
  assert.equal(displayedTags.includes("运动"), true);
  assert.equal(await ordinaryTagCard.locator(".anime-tags .is-ordinary").textContent(), "运动");
  const scoreStyle = await ordinaryTagCard.locator(".score-badge").evaluate((node) => ({
    top: getComputedStyle(node).top,
    width: parseFloat(getComputedStyle(node).width),
    fontSize: parseFloat(getComputedStyle(node.firstElementChild).fontSize),
    transform: getComputedStyle(node.firstElementChild).transform,
    clipPath: getComputedStyle(node).clipPath,
  }));
  assert.notEqual(scoreStyle.top, "auto");
  assert.ok(scoreStyle.fontSize >= 12);
  assert.ok(scoreStyle.width <= 60);
  assert.match(scoreStyle.transform, /matrix\(0\.707/);
  assert.match(scoreStyle.clipPath, /polygon/);
  await page.locator("#searchInput").fill("");
  assert.ok(Number.parseFloat(await page.locator(".timeline-item span").first().evaluate((node) => getComputedStyle(node).fontSize)) >= 15);
  assert.equal(await page.locator(".poster-info h3").first().evaluate((node) => getComputedStyle(node).whiteSpace), "nowrap");
  assert.equal(await page.locator(".poster-info h3").first().evaluate((node) => getComputedStyle(node).marginBottom), "0px");
  assert.notEqual(await page.locator(".poster-info > p").first().evaluate((node) => getComputedStyle(node).lineHeight), "normal");
  await page.locator(".poster-card").first().screenshot({ path: "tests/poster-actions-preview-latest.png" });

  await page.locator("#openManualAdd").click();
  await page.locator("#manualDialog").waitFor({ state: "visible" });
  await page.locator('#manualDialog [data-action="close-manual"]').first().click();
  assert.equal(await page.locator("#manualDialog").isVisible(), false);

  await page.locator("#searchInput").fill("动物新世代");
  assert.equal(await page.locator('.poster-card .anime-tags span', { hasText: "TV" }).count(), 0);
  await page.locator("#searchInput").fill("阿拉蕾 hello!不可思议岛");
  assert.equal(await page.locator('.poster-card .anime-tags span', { hasText: "漫画改" }).getAttribute("title"), "番组计划归档未提供人数");
  await page.locator("#searchInput").fill("");

  const initialPeriodLabel = await page.locator("#activePeriodLabel").textContent();
  await page.locator("#searchInput").fill("网球甜心 剧场版");
  assert.equal(await page.locator("#activePeriodLabel").textContent(), "全年代搜索");
  assert.equal(await page.locator("#timelineTitle").textContent(), "正在搜索全部年代");
  assert.equal(await page.locator("#resultCount").textContent(), "1");
  assert.equal((await page.locator(".poster-card h3").textContent()).trim(), "网球甜心 剧场版");
  await page.locator("#searchInput").fill("");
  assert.equal(await page.locator("#activePeriodLabel").textContent(), initialPeriodLabel);
  assert.equal(await page.locator("#timelineTitle").textContent(), "选择年代");

  await page.locator("#searchInput").fill("赛博朋克：边缘行者");
  assert.equal(await page.locator('#posterGrid [data-browse-id="bgm-309311"]').count(), 1);
  assert.equal(await page.evaluate(() => window.ANIME_DATA.find((item) => item.id === "bgm-309311")?.type), "web");
  const cyberpunkCard = page.locator('#posterGrid [data-browse-id="bgm-309311"]');
  assert.equal((await cyberpunkCard.locator(".type-badge").textContent()).trim(), "WEB动画");
  assert.equal(await cyberpunkCard.locator(".anime-tags span", { hasText: /^WEB(?:\s|$)/i }).count(), 0);
  await page.locator("#searchInput").fill("");

  await page.locator("#searchInput").fill("鬼灭之刃 上弦集结、前往锻刀村");
  assert.equal(await page.locator("#resultCount").textContent(), "0");
  await page.locator("#compilationToggle").uncheck();
  await page.locator("#lowVoteToggle").uncheck();
  assert.equal(await page.locator("#resultCount").textContent(), "1");
  assert.equal((await page.locator(".poster-card h3").textContent()).trim(), "鬼灭之刃 上弦集结、前往锻刀村");
  await page.locator("#clearFilters").click();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.locator("#backToTop.is-visible").waitFor();
  await page.locator("#backToTop").click();
  await page.waitForFunction(() => window.scrollY < 10);
  await page.screenshot({ path: "tests/desktop-browse-preview-latest.png" });

  await page.locator("#sortSelect").selectOption("votes");
  await page.locator("#sortDirection").selectOption("asc");
  const ascendingVotes = await page.evaluate(() => {
    const byId = new Map(window.ANIME_DATA.map((item) => [item.id, item.voteCount || 0]));
    return [...document.querySelectorAll("#posterGrid [data-browse-id]")].map((node) => byId.get(node.dataset.browseId));
  });
  assert.ok(ascendingVotes[0] <= ascendingVotes.at(-1));
  await page.locator("#sortDirection").selectOption("desc");
  const descendingVotes = await page.evaluate(() => {
    const byId = new Map(window.ANIME_DATA.map((item) => [item.id, item.voteCount || 0]));
    return [...document.querySelectorAll("#posterGrid [data-browse-id]")].map((node) => byId.get(node.dataset.browseId));
  });
  assert.ok(descendingVotes[0] >= descendingVotes.at(-1));
  const firstVotes = await page.locator(".poster-card .card-meta-row span").filter({ hasText: "人评分" }).first().textContent();
  assert.ok(Number(firstVotes.replace(/\D/g, "")) >= 10);
  const firstTitle = await page.locator(".poster-card h3").first().textContent();
  const firstRecord = await page.evaluate((title) => {
    const item = window.ANIME_DATA.find((candidate) => candidate.title === title.trim());
    return {
      year: item.year,
      period: window.AnimeCore.periodForYear(item.year),
      type: item.type,
      season: item.season,
    };
  }, firstTitle);
  await page.evaluate((title) => {
    const item = window.ANIME_DATA.find((candidate) => candidate.title === title.trim());
    localStorage.setItem("anime-atlas:collection:v1", JSON.stringify([{ ...item, reaction: "watched", addedAt: new Date().toISOString() }]));
  }, firstTitle);
  await page.reload({ waitUntil: "domcontentloaded" });

  await navigate("collection");
  await page.locator("#collectionView").waitFor({ state: "visible" });
  assert.equal(await page.locator("#collectionView > .catalog-header .muted-text").count(), 0);
  assert.equal(await page.locator(".timeline-shell").isHidden(), true);
  assert.equal(await page.locator(".history-entry").count(), 1);
  assert.equal((await page.locator(".history-entry").textContent()).trim().startsWith(firstTitle.trim()), true);
  assert.equal(await page.locator(".memory-card").count(), 1);
  assert.ok(await page.locator(".memory-card .anime-tags").count() > 0);
  assert.ok(await page.locator(".collection-insights article").count() >= 1);
  assert.equal(await page.locator(".type-donut").count(), 0);
  assert.equal(await page.locator("#clearCollectionFilters").isHidden(), true);
  assert.equal(await page.locator(".year-line-chart").count(), 1);
  assert.ok(await page.locator(".chart-year-dots .chart-point text").count() > 0);
  const recentChartRange = await page.locator(".year-line-chart").evaluate((node) => ({
    first: Number(node.dataset.firstChartYear),
    last: Number(node.dataset.lastChartYear),
  }));
  assert.equal(recentChartRange.last - recentChartRange.first, 9);
  await page.locator("#collectionRecentYearsToggle").uncheck();
  assert.equal(Number(await page.locator(".year-line-chart").getAttribute("data-first-chart-year")), firstRecord.year);
  await page.locator("#collectionRecentYearsToggle").check();
  assert.equal(await page.locator(".popularity-extreme").count(), 2);
  assert.ok((await page.locator(".popularity-extremes").textContent()).includes("最热门"));
  assert.ok((await page.locator(".popularity-extremes").textContent()).includes("最冷门"));

  await page.locator(`.chart-point[data-chart-year="${firstRecord.year}"] circle`).click();
  assert.equal(await page.locator("#collectionView").isVisible(), true);
  assert.equal(await page.locator("#collectionFilterCount").textContent(), "1");
  assert.equal(await page.locator("#historyTableBody tr").count(), 1);

  await page.locator(`[data-collection-type="${firstRecord.type}"]`).click();
  assert.equal(await page.locator("#collectionFilterCount").textContent(), "1");
  if (firstRecord.type === "tv") {
    await page.locator("#collectionSeasonRow").waitFor({ state: "visible" });
    await page.locator(`[data-collection-season="${firstRecord.season}"]`).click();
    assert.equal(await page.locator("#collectionFilterCount").textContent(), "1");
  }
  const wrongType = ["tv", "web", "movie", "theatrical", "other"].find((type) => type !== firstRecord.type);
  await page.locator(`[data-collection-type="${wrongType}"]`).click();
  assert.equal(await page.locator("#collectionFilterCount").textContent(), "0");
  assert.equal(await page.locator(".memory-card").count(), 0);
  assert.equal(await page.locator("#clearCollectionFilters").isVisible(), true);
  await page.locator("#clearCollectionFilters").click();
  assert.equal(await page.locator("#collectionFilterCount").textContent(), "1");
  assert.equal(await page.locator(".memory-card").count(), 1);
  assert.equal(await page.locator("#clearCollectionFilters").isHidden(), true);

  await page.screenshot({ path: "tests/desktop-preview-latest.png" });

  await page.locator('[data-collection-mode="table"]').click();
  await page.locator("#collectionTablePanel").waitFor({ state: "visible" });
  assert.equal(await page.locator("#historyPreview").count(), 0);
  assert.ok((await page.locator(".history-entry .anime-title-link").getAttribute("href")).includes("bgm.tv/subject/"));

  await navigate("browse");
  await page.locator('[data-period="2016"]').click();
  await page.waitForTimeout(700);
  await page.locator('[data-catalog-mode="monthly"]').click();
  await page.locator("#monthlyCatalog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#monthlyCatalog img").count(), 0);
  assert.ok(await page.locator("#monthlyCatalog .anime-tags").count() > 0);
  assert.equal(await page.locator("#monthlyCatalog .record-toggle-button").count(), 0);
  assert.equal(await page.locator("#monthlyCatalog .monthly-table").first().locator("thead th").count(), 5);
  await page.locator(".month-section").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "tests/monthly-preview-latest.png" });
  const julyRow = page.locator('[data-browse-month="7"] [data-browse-id]').first();
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
  await julyRow.evaluate((node) => node.scrollIntoView({ block: "start" }));
  const anchor = await page.locator('#monthlyCatalog [data-browse-id]').evaluateAll((nodes) => nodes
    .map((node) => ({ id: node.dataset.browseId, top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom }))
    .filter((item) => item.bottom > 90 && item.top < innerHeight)
    .sort((a, b) => Math.abs(a.top - 120) - Math.abs(b.top - 120))[0]);
  await page.locator('.catalog-mode-group.is-floating [data-catalog-mode="poster"]').click();
  const posterAnchor = page.locator(`[data-browse-id="${anchor.id}"]`).first();
  await posterAnchor.waitFor();
  await page.waitForTimeout(250);
  const restoredTop = await posterAnchor.evaluate((node) => node.getBoundingClientRect().top);
  assert.ok(Math.abs(restoredTop - anchor.top) < 120);

  await page.locator('[data-type="tv"]').click();
  await page.locator("#tvSeasonRow").waitFor({ state: "visible" });

  await navigate("themes");
  await page.locator("#themesView").waitFor({ state: "visible" });
  assert.equal(await page.locator(".room-object").count(), 0);
  assert.equal(await page.locator(".theme-matrix-group").count(), 0);
  assert.equal(await page.locator(".theme-flat-grid").count(), 1);
  assert.equal(await page.locator(".theme-matrix-card").count(), 20);
  assert.equal(await page.locator(".theme-single-card > small").count(), 0);
  assert.equal((await page.locator("#browseForTheme").textContent()).trim(), "去动画库挑作品");
  assert.equal(await page.locator(".theme-single-poster.is-empty").count(), 20);
  await page.locator("#openCustomTheme").click();
  await page.locator('#customThemeForm [name="icon"]').fill("🌠");
  await page.locator('#customThemeForm [name="title"]').fill("一生难忘的结局");
  await page.locator('#customThemeForm [name="description"]').fill("谢幕以后仍会想起的作品");
  await page.locator('#customThemeForm button[type="submit"]').click();
  assert.equal(await page.locator(".theme-matrix-card").count(), 21);
  assert.equal(await page.locator('.theme-matrix-card.is-custom').count(), 1);
  assert.equal(await page.locator("#themeDescription").textContent(), "谢幕以后仍会想起的作品");
  await page.locator('.theme-matrix-card[data-theme-id="recommend"]').click();
  await page.locator("#themeSearchInput").fill("天气之子");
  await page.locator('[data-theme-toggle]').first().click();
  assert.equal(await page.locator("#themeItemCount").textContent(), "1");
  assert.equal(await page.locator(".theme-card").count(), 1);
  await page.locator("#browseForTheme").click();
  await page.locator("#clearFilters").click();
  await page.locator("#searchInput").fill("企鹅公路");
  await page.locator(".poster-card").click({ button: "right" });
  await page.locator('[data-quick-theme="recommend"]').click();
  await navigate("themes");
  assert.equal(await page.locator("#themeItemCount").textContent(), "1");
  assert.equal(await page.locator('.theme-matrix-card[data-theme-id="recommend"] .theme-single-poster:not(.is-empty)').count(), 1);
  assert.equal(await page.locator('.theme-matrix-card[data-theme-id="annual"]').count(), 0);
  await page.locator('.theme-matrix-card[data-theme-id="comfort"]').click();
  await page.locator("#themeSearchInput").fill("动物新世代");
  await page.locator('[data-theme-toggle]').first().click();
  await page.locator('[data-theme-note]').fill("音乐和角色相处的氛围很舒服");
  await page.locator('[data-theme-note]').press("Tab");
  assert.equal((await page.locator('[data-theme-note]').inputValue()), "音乐和角色相处的氛围很舒服");
  await page.screenshot({ path: "tests/theme-profile-preview-latest.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "tests/mobile-preview-latest.png" });

  await page.evaluate(() => {
    const titles = new Set(["网球甜心", "网球甜心 剧场版"]);
    const records = window.ANIME_DATA
      .filter((item) => titles.has(item.title))
      .map((item) => ({ ...item, reaction: "watched" }));
    localStorage.setItem("anime-atlas:collection:v1", JSON.stringify(records));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await navigate("collection");
  assert.equal(await page.locator(".franchise-work").count(), 2);
  assert.equal(await page.locator(".franchise-poster img").count(), 2);
  assert.equal(await page.locator(".tag-cloud-card").count(), 0);

  await page.evaluate(() => {
    const records = window.ANIME_DATA
      .filter((item) => item.bangumiTags?.length >= 3)
      .slice(0, 11)
      .map((item) => ({ ...item, reaction: "recommended" }));
    localStorage.setItem("anime-atlas:collection:v1", JSON.stringify(records));
    const lists = JSON.parse(localStorage.getItem("anime-atlas:theme-lists:v1") || "[]");
    const recommend = lists.find((list) => list.id === "recommend");
    recommend.records = records.map((item) => ({ id: item.id, note: "", bucketYear: null }));
    localStorage.setItem("anime-atlas:theme-lists:v1", JSON.stringify(lists));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await navigate("collection");
  assert.equal(await page.locator(".recommended-tag-card").count(), 1);
  assert.equal(await page.locator(".recommended-tag-bars li").count(), 10);
  assert.equal(await page.locator(".recommended-tag-line-chart").count(), 0);
  assert.ok((await page.locator(".recommended-tag-card").textContent()).includes("已经安利成功多少份"));
  const recommendationTags = await page.locator(".recommended-tag-bars li b").allTextContents();
  assert.equal(recommendationTags.some((tag) => ["TV", "剧场版", "动画电影", "电影", "OVA"].includes(tag)), false);
  await page.screenshot({ path: "tests/collection-insights-preview-latest.png", fullPage: true });

  await navigate("annual");
  assert.equal(await page.locator("#annualView > .catalog-header .muted-text").count(), 0);
  const annualShareButtonStyle = await page.locator("#exportAnnualImage").evaluate((node) => ({
    fontSize: parseFloat(getComputedStyle(node).fontSize),
    minHeight: parseFloat(getComputedStyle(node).minHeight),
  }));
  assert.equal((await page.locator("#exportAnnualImage").textContent()).trim(), "生成分享图");
  assert.ok(annualShareButtonStyle.fontSize >= 14);
  assert.ok(annualShareButtonStyle.minHeight >= 40);
  assert.equal(await page.locator(`#annualPageYear option[value="${currentYear + 1}"]`).count(), 0);
  await page.locator("#annualPageYear").selectOption("2023");
  assert.equal(await page.locator('#annualCatalogGrid [data-annual-year]:not([data-annual-year="2023"])').count(), 0);
  assert.ok(await page.locator("#annualCatalogGrid .annual-catalog-card").count() > 10);
  assert.equal(await page.locator('[data-annual-origin="jp"]').getAttribute("aria-selected"), "true");
  await page.locator('[data-annual-type="tv"]').click();
  await page.locator("#annualSeasonRow").waitFor({ state: "visible" });
  await page.locator('[data-annual-season="7"]').click();
  assert.ok((await page.locator("#annualCatalogTitle").textContent()).includes("7月番"));
  await page.locator('[data-annual-origin="cn"]').click();
  assert.equal(await page.locator('[data-annual-origin="cn"]').getAttribute("aria-selected"), "true");
  assert.equal(await page.locator('#annualCatalogGrid [data-annual-catalog-origin="jp"]').count(), 0);
  assert.ok(await page.locator('[data-annual-type="cn-web"]').count() === 1);
  await page.locator('[data-annual-origin="jp"]').click();
  assert.equal(await page.locator("#annualSortSelect").inputValue(), "votes");
  await page.locator("#annualSortSelect").selectOption("score");
  await page.locator("#annualSortDirection").selectOption("asc");
  assert.equal(await page.locator("#annualSortSelect").inputValue(), "score");
  assert.equal(await page.locator("#annualSortDirection").inputValue(), "asc");
  await page.locator("#annualCatalogGrid [data-annual-toggle]").first().click();
  assert.equal(await page.locator("#annualSelectedCount").textContent(), "1");
  assert.equal(await page.locator("#annualSelectedGrid .annual-selected-card").count(), 1);
  assert.equal(await page.locator("#annualSelectedGrid .annual-rank").count(), 0);
  assert.ok((await page.locator("#annualSelectedGrid .annual-selected-remove").getAttribute("aria-label")).includes("移除"));
  await page.locator("#annualSelectedGrid .annual-selected-remove").click();
  assert.equal(await page.locator("#annualSelectedCount").textContent(), "0");
  await page.locator("#annualCatalogGrid [data-annual-toggle]").first().click();
  const selectedPosterBox = await page.locator("#annualSelectedGrid .annual-poster").boundingBox();
  assert.ok(selectedPosterBox.width > 150 && selectedPosterBox.height > 220);
  await page.locator("#annualPageYear").selectOption("2022");
  assert.equal(await page.locator("#annualSelectedCount").textContent(), "0");
  await page.locator("#annualPageYear").selectOption("2023");
  assert.equal(await page.locator("#annualSelectedCount").textContent(), "1");
  for (let index = 1; index < 10; index += 1) {
    await page.locator('#annualCatalogGrid [data-annual-toggle]:not(.is-active):not([disabled])').first().click();
  }
  assert.equal(await page.locator("#annualSelectedCount").textContent(), "10");
  assert.equal(await page.locator("#annualSelectedGrid .annual-selected-card.is-best").count(), 1);
  assert.equal(await page.locator("#annualSelectedGrid .annual-selected-card.is-best h4").count(), 0);
  assert.equal(await page.locator("#annualSelectedGrid .annual-selected-card small").count(), 0);
  const bestPosterBox = await page.locator("#annualSelectedGrid .annual-selected-card.is-best .annual-poster").boundingBox();
  const supplementPosterBox = await page.locator("#annualSelectedGrid .annual-selected-card:not(.is-best) .annual-poster").first().boundingBox();
  assert.ok(bestPosterBox.width > supplementPosterBox.width);
  await page.waitForTimeout(500);
  await page.locator("#annualSelectedGrid").evaluate((node) => window.scrollTo(0, window.scrollY + node.getBoundingClientRect().top - 80));
  const desktopDragSource = page.locator("#annualSelectedGrid .annual-selected-card").nth(1);
  const desktopDragTarget = page.locator("#annualSelectedGrid .annual-selected-card").first();
  const draggedAnnualId = await desktopDragSource.getAttribute("data-annual-record-id");
  const replacedAnnualId = await desktopDragTarget.getAttribute("data-annual-record-id");
  const desktopDragSourceBox = await desktopDragSource.boundingBox();
  const desktopDragTargetBox = await desktopDragTarget.boundingBox();
  await page.mouse.move(desktopDragSourceBox.x + desktopDragSourceBox.width / 2, desktopDragSourceBox.y + desktopDragSourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(desktopDragTargetBox.x + desktopDragTargetBox.width / 2, desktopDragTargetBox.y + desktopDragTargetBox.height / 2, { steps: 8 });
  await page.mouse.up();
  assert.equal(await page.locator("#annualSelectedGrid .annual-selected-card").first().getAttribute("data-annual-record-id"), draggedAnnualId);
  assert.equal(await page.locator("#annualSelectedGrid .annual-selected-card").nth(1).getAttribute("data-annual-record-id"), replacedAnnualId);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("anime-atlas:theme-lists:v1")).find((list) => list.id === "annual").records.filter((record) => record.bucketYear === 2023)[0].id), draggedAnnualId);
  await page.locator("#annualView").evaluate((node) => node.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: "tests/annual-top-ten-desktop-latest.png" });
  await page.locator("#exportAnnualImage").click();
  await page.locator(".share-preview-item img").waitFor({ state: "visible", timeout: 60000 });
  assert.equal(await page.locator("#shareDialog").getAttribute("class"), "share-dialog is-annual-only");
  assert.deepEqual(await page.locator(".share-preview-item img").evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight })), { width: 1080, height: 1440 });
  await page.locator("#shareDialog").screenshot({ path: "tests/annual-share-preview-latest.png" });
  await page.locator("#closeShareDialog").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#annualView").evaluate((node) => node.scrollIntoView({ block: "start" }));
  const mobileAnnualShareBox = await page.locator("#exportAnnualImage").boundingBox();
  assert.ok(mobileAnnualShareBox.width <= 180);
  await page.screenshot({ path: "tests/annual-top-ten-mobile-latest.png" });
  await page.waitForTimeout(350);
  await page.locator("#annualSelectedGrid").evaluate((node) => window.scrollTo(0, window.scrollY + node.getBoundingClientRect().top - 70));
  const touchSource = page.locator("#annualSelectedGrid .annual-selected-card").nth(1);
  const touchTarget = page.locator("#annualSelectedGrid .annual-selected-card").first();
  const touchSourceId = await touchSource.getAttribute("data-annual-record-id");
  const touchTargetId = await touchTarget.getAttribute("data-annual-record-id");
  const touchSourceBox = await touchSource.boundingBox();
  const touchTargetBox = await touchTarget.boundingBox();
  await touchSource.dispatchEvent("pointerdown", { pointerId: 91, pointerType: "touch", clientX: touchSourceBox.x + 20, clientY: touchSourceBox.y + 20, bubbles: true });
  await page.waitForTimeout(520);
  await page.locator("#annualSelectedGrid").dispatchEvent("pointermove", { pointerId: 91, pointerType: "touch", clientX: touchTargetBox.x + 20, clientY: touchTargetBox.y + 20, bubbles: true });
  await page.locator("#annualSelectedGrid").dispatchEvent("pointerup", { pointerId: 91, pointerType: "touch", clientX: touchTargetBox.x + 20, clientY: touchTargetBox.y + 20, bubbles: true });
  assert.equal(await page.locator("#annualSelectedGrid .annual-selected-card").first().getAttribute("data-annual-record-id"), touchSourceId);
  assert.equal(await page.locator("#annualSelectedGrid .annual-selected-card").nth(1).getAttribute("data-annual-record-id"), touchTargetId);

  await page.locator("#clearAnnualYear").click();
  await page.locator("#confirmClearDialog").waitFor({ state: "visible" });
  await page.locator("#cancelClearAction").click();
  assert.equal(await page.locator("#annualSelectedCount").textContent(), "10");
  await page.locator("#clearAnnualYear").click();
  await page.locator("#confirmClearAction").click();
  assert.equal(await page.locator("#annualSelectedCount").textContent(), "0");

  await navigate("collection");
  assert.ok(Number((await page.locator("#headerSelectedCount").textContent()).replaceAll(",", "")) > 0);
  await page.locator("#clearCollection").click();
  await page.locator("#cancelClearAction").click();
  assert.ok(Number((await page.locator("#headerSelectedCount").textContent()).replaceAll(",", "")) > 0);
  await page.locator("#clearCollection").click();
  await page.locator("#confirmClearAction").click();
  assert.equal(await page.locator("#headerSelectedCount").textContent(), "0");

  assert.deepEqual(pageErrors, []);
  await browser.close();
  console.log("Browser smoke test passed: data load, collection grouping, table, desktop and mobile layouts.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
