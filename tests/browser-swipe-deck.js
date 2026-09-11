const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(25000);
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
  assert.equal(await page.locator("#swipePanel").isVisible(), true);
  assert.equal(await page.locator(".primary-nav").evaluate((navigation) => Number(getComputedStyle(navigation).opacity)), 0);
  assert.equal(await page.locator("#openSelection").getAttribute("aria-expanded"), "false");
  assert.equal((await page.locator(".swipe-panel-header").textContent()).trim(), "SWIPE YOUR ANIME MEMORY");
  assert.equal(await page.locator('.nav-button[data-view="swipe"]').count(), 1);
  assert.equal(await page.locator('.nav-button[data-view="swipe"]').getAttribute("aria-current"), "page");
  assert.equal((await page.locator(".nav-button").last().textContent()).trim(), "动画库");
  assert.equal(await page.getByText(/20\s*道题|逐题填写/).count(), 0);
  await page.locator('.swipe-card[data-stack-index="0"]').waitFor();
  await page.waitForTimeout(650);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "tests/swipe-home-desktop.png" });

  await navigate("browse");
  assert.equal(await page.locator("#browseView").isVisible(), true);
  await page.locator("#homeBrand").click();
  assert.equal(await page.locator("#swipePanel").isVisible(), true);
  await page.waitForTimeout(500);

  assert.equal(await page.locator(".swipe-card").count(), 4);
  assert.equal(await page.locator("#swipePanel").isVisible(), true);
  const stackStyles = await page.locator(".swipe-card").evaluateAll((cards) => cards.map((card) => ({
    index: Number(card.dataset.stackIndex),
    transform: getComputedStyle(card).transform,
    filter: getComputedStyle(card).filter,
  })).sort((a, b) => a.index - b.index));
  assert.notEqual(stackStyles[0].transform, stackStyles[1].transform);
  assert.match(stackStyles[0].filter, /^blur\(0px\)/);
  assert.notEqual(stackStyles[1].filter, stackStyles[0].filter);
  const cardPositions = await page.locator('.swipe-card[data-stack-index="0"], .swipe-card[data-stack-index="1"]').evaluateAll((cards) => cards.map((card) => ({
    index: Number(card.dataset.stackIndex), rect: card.getBoundingClientRect().toJSON(),
  })).sort((a, b) => a.index - b.index));
  const stagePosition = await page.locator("#swipeStage").evaluate((stage) => stage.getBoundingClientRect().toJSON());
  assert.ok(Math.abs((cardPositions[0].rect.x + cardPositions[0].rect.width / 2) - (stagePosition.x + stagePosition.width / 2)) < 3);
  assert.ok(cardPositions[1].rect.x > cardPositions[0].rect.x + 45);
  assert.ok(cardPositions[1].rect.y < cardPositions[0].rect.y);
  const scoreAndVotes = await page.locator('.swipe-card[data-stack-index="0"] .swipe-card-metrics').textContent();
  assert.match(scoreAndVotes, /★|评分样本较少/);
  assert.match(scoreAndVotes, /人评分/);

  const setRange = async (selector, value) => page.locator(selector).evaluate((control, next) => {
    control.value = String(next);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await setRange("#swipeStartYear", 2020);
  await page.locator("#swipeMinVotesPreset").selectOption("custom");
  assert.equal(await page.locator("#swipeMinVotesCustomField").isVisible(), true);
  await page.locator("#swipeMinVotesCustom").fill("777");
  await page.locator("#swipeMinVotesPreset").selectOption("100");
  assert.equal(await page.locator("#swipeMinVotesCustomField").isHidden(), true);
  await setRange("#swipeMinScore", 6);
  await setRange("#swipeMaxScore", 9);
  await page.locator("#swipeExcludeChinese").check();
  await page.locator("#swipeExcludeWeb").check();
  await page.locator("#swipeExcludeMovie").check();
  await page.locator("#swipeExcludeTheatrical").check();
  await page.locator("#swipeExcludeCompilation").check();
  await page.locator("#swipeExcludeOther").check();
  await page.locator("#applySwipeFilters").click();
  await page.locator('.swipe-card[data-stack-index="0"]').waitFor();
  const filteredCards = await page.locator(".swipe-card").evaluateAll((cards) => cards.map((card) => ({ ...card.dataset })));
  assert.ok(filteredCards.length > 0);
  filteredCards.forEach((card) => {
    assert.ok(Number(card.swipeYear) >= 2020);
    assert.ok(Number(card.swipeVotes) >= 100);
    assert.ok(Number(card.swipeScore) >= 6 && Number(card.swipeScore) <= 9);
    assert.equal(card.swipeOrigin, "jp");
    assert.equal(card.swipeType, "tv");
    assert.equal(card.swipeCompilation, "false");
  });
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("anime-atlas:swipe-filters:v1"))), {
    startYear: 2020,
    minVotes: 100,
    minScore: 6,
    maxScore: 9,
    excludeChinese: true,
    excludeWeb: true,
    excludeMovie: true,
    excludeTheatrical: true,
    excludeCompilation: true,
    excludeOther: true,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('.swipe-card[data-stack-index="0"]').waitFor();
  assert.equal(await page.locator("#swipeStartYear").inputValue(), "2020");
  assert.equal(await page.locator("#swipeMinVotesPreset").inputValue(), "100");
  assert.equal(await page.locator("#swipeMinScore").inputValue(), "6");
  assert.equal(await page.locator("#swipeMaxScore").inputValue(), "9");
  assert.equal(await page.locator("#swipeExcludeChinese").isChecked(), true);
  assert.equal(await page.locator("#swipeExcludeWeb").isChecked(), true);
  assert.equal(await page.locator("#swipeExcludeCompilation").isChecked(), true);

  const topId = () => page.locator('.swipe-card[data-stack-index="0"]').getAttribute("data-swipe-id");
  const waitForNext = async (id) => page.waitForFunction((previous) => document.querySelector('.swipe-card[data-stack-index="0"]')?.dataset.swipeId !== previous, id);

  const watchedId = await topId();
  await page.locator('[data-swipe-action="watched"]').click();
  await waitForNext(watchedId);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:collection:v1") || "[]").some((item) => item.id === id), watchedId), true);

  const recommendId = await topId();
  await page.locator('[data-swipe-action="recommend"]').click();
  await waitForNext(recommendId);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:theme-lists:v1") || "[]").find((list) => list.id === "recommend")?.records.some((record) => record.id === id) || false, recommendId), false);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:collection:v1") || "[]").find((item) => item.id === id)?.reaction, recommendId), "recommended");

  const worstId = await topId();
  await page.locator('[data-swipe-action="worst"]').click();
  await waitForNext(worstId);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:theme-lists:v1") || "[]").find((list) => list.id === "worst")?.records.some((record) => record.id === id) || false, worstId), false);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:collection:v1") || "[]").find((item) => item.id === id)?.reaction, worstId), "difficult");

  const unseenId = await topId();
  await page.locator('[data-swipe-action="unseen"]').click();
  await waitForNext(unseenId);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:swipe-skipped:v1") || "[]").includes(id), unseenId), true);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:collection:v1") || "[]").some((item) => item.id === id), unseenId), false);

  const draggedId = await topId();
  await page.waitForTimeout(380);
  const box = await page.locator('.swipe-card[data-stack-index="0"]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 130, box.y + box.height / 2 + 8, { steps: 8 });
  await page.mouse.up();
  await waitForNext(draggedId);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:collection:v1") || "[]").some((item) => item.id === id), draggedId), true);

  await page.locator("#undoSwipeDecision").click();
  assert.equal(await topId(), draggedId);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:collection:v1") || "[]").some((item) => item.id === id), draggedId), false);
  await page.locator("#undoSwipeDecision").click();
  assert.equal(await topId(), unseenId);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:swipe-skipped:v1") || "[]").includes(id), unseenId), false);

  await page.locator('[data-swipe-action="unseen"]').click();
  await waitForNext(unseenId);
  await page.locator('[data-swipe-action="watched"]').click();
  await waitForNext(draggedId);
  await page.waitForTimeout(950);
  const topPosterFallback = await page.locator('.swipe-card[data-stack-index="0"]').evaluate((card) => {
    const image = card.querySelector("img");
    return !image || image.naturalWidth > 0 || card.classList.contains("has-fallback");
  });
  assert.equal(topPosterFallback, true);
  await page.locator("#swipePanel").screenshot({ path: "tests/swipe-deck-desktop.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => !document.querySelector("#swipeFilterPanel").open);
  await page.screenshot({ path: "tests/swipe-home-mobile.png" });
  const mobileDeck = await page.locator(".swipe-deck").boundingBox();
  const mobileCenterOffset = await page.locator('.swipe-card[data-stack-index="0"]').evaluate((card) => {
    const cardRect = card.getBoundingClientRect();
    const stageRect = document.querySelector("#swipeStage").getBoundingClientRect();
    return Math.abs((cardRect.left + cardRect.width / 2) - (stageRect.left + stageRect.width / 2));
  });
  assert.ok(mobileDeck.width <= 362 && mobileDeck.height <= 350);
  assert.ok(mobileCenterOffset < 3);
  assert.equal(await page.locator(".swipe-actions button").count(), 4);
  assert.equal(await page.locator("#exitSwipeMode").count(), 0);
  assert.equal(await page.locator(".primary-nav").evaluate((navigation) => Number(getComputedStyle(navigation).opacity)), 0);
  await page.locator("#openSelection").click();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector(".primary-nav")).opacity) === 1);
  assert.equal(await page.locator(".primary-nav").evaluate((navigation) => Number(getComputedStyle(navigation).opacity)), 1);
  assert.equal(await page.locator("#openSelection").getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator(".nav-button").count(), 5);
  const mobileLayout = await page.evaluate(() => {
    const navButtons = [...document.querySelectorAll(".nav-button")];
    const action = document.querySelector(".swipe-actions button").getBoundingClientRect();
    const currentCard = document.querySelector('.swipe-card[data-stack-index="0"]').getBoundingClientRect();
    return {
      navOneLine: navButtons.every((button) => getComputedStyle(button).whiteSpace === "nowrap" && button.scrollHeight <= button.clientHeight + 1),
      navHeight: document.querySelector(".primary-nav").getBoundingClientRect().height,
      actionHeight: action.height,
      cardWidth: currentCard.width,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert.equal(mobileLayout.navOneLine, true);
  assert.ok(mobileLayout.navHeight >= 220 && mobileLayout.navHeight <= 280);
  assert.ok(mobileLayout.actionHeight <= 52);
  assert.ok(mobileLayout.cardWidth <= 210);
  assert.ok(mobileLayout.horizontalOverflow <= 1);
  assert.equal(await page.locator("#swipeFilterPanel").getAttribute("open"), null);
  await page.locator("#swipeFilterPanel > summary").click();
  assert.equal(await page.locator("#swipeMinVotesPreset").isVisible(), true);
  await page.locator("#swipeMinVotesPreset").selectOption("custom");
  assert.equal(await page.locator("#swipeMinVotesCustomField").isVisible(), true);
  await page.locator("#swipeMinVotesCustom").fill("1234");
  await page.locator("#swipeMinVotesPreset").selectOption("100");
  assert.equal(await page.locator("#swipeMinVotesCustomField").isHidden(), true);
  assert.ok(await page.locator("#swipeFilterPanel").evaluate((panel) => panel.scrollWidth <= panel.clientWidth + 1));
  await page.locator("#swipeFilterPanel").screenshot({ path: "tests/swipe-filter-mobile.png" });
  await page.locator("#swipeFilterPanel > summary").click();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector(".back-to-top")).opacity) === 0);
  assert.equal(await page.locator(".back-to-top").evaluate((button) => Number(getComputedStyle(button).opacity)), 0);
  await page.locator("#swipePanel").screenshot({ path: "tests/swipe-deck-mobile.png" });

  await navigate("collection");
  await page.waitForTimeout(350);
  assert.equal(await page.locator("#swipePanel").isHidden(), true);
  assert.equal(await page.locator("#collectionGallery").isVisible(), true);
  assert.equal(await page.locator(".primary-nav").evaluate((navigation) => Number(getComputedStyle(navigation).opacity)), 0);
  const recommendedTitle = page.locator(`#collectionGallery [data-theme-context-id="${recommendId}"] .reaction-title--recommended > .anime-title-link`);
  const difficultTitle = page.locator(`#collectionGallery [data-theme-context-id="${worstId}"] .reaction-title--difficult > .anime-title-link`);
  assert.equal(await recommendedTitle.evaluate((title) => getComputedStyle(title).animationName), "reaction-rainbow-flow");
  assert.equal(await difficultTitle.evaluate((title) => getComputedStyle(title).fontStyle), "italic");
  await page.locator("#collectionGallery").screenshot({ path: "tests/swipe-reaction-styles-mobile.png" });
  await page.locator('[data-collection-mode="table"]').click();
  assert.equal(await page.locator(`#historyTableBody [data-theme-context-id="${recommendId}"] .reaction-title--recommended`).count(), 1);
  assert.equal(await page.locator(`#historyTableBody [data-theme-context-id="${worstId}"] .reaction-title--difficult`).count(), 1);

  await page.locator("#importInput").setInputFiles({
    name: "swipe-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      format: "anime-atlas-collection",
      version: 3,
      records: [{ id: unseenId, title: "恢复测试", year: 2020, type: "tv", season: "1" }],
      swipeSkipped: [unseenId],
    })),
  });
  await page.waitForFunction((id) => JSON.parse(localStorage.getItem("anime-atlas:collection:v1") || "[]").some((item) => item.id === id), unseenId);
  assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem("anime-atlas:swipe-skipped:v1") || "[]").includes(id), unseenId), false);

  const externallyWatchedId = await topId();
  await page.evaluate((id) => {
    const records = JSON.parse(localStorage.getItem("anime-atlas:collection:v1") || "[]");
    const item = window.ANIME_DATA.find((candidate) => candidate.id === id);
    localStorage.setItem("anime-atlas:collection:v1", JSON.stringify([...records, { ...item, reaction: "watched" }]));
  }, externallyWatchedId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('.swipe-card[data-stack-index="0"]').waitFor();
  assert.equal(await page.locator(`.swipe-card[data-swipe-id="${externallyWatchedId}"]`).count(), 0);

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("Swipe deck gestures, actions, persistence, stack visuals and mobile layout passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
