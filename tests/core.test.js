const assert = require("node:assert/strict");
const test = require("node:test");
const Core = require("../core.js");

test("periodForYear groups pre-50s, 50s–80s and 90s onward correctly", () => {
  assert.equal(Core.periodForYear(1917), "pre1950");
  assert.equal(Core.periodForYear(1949), "pre1950");
  assert.equal(Core.periodForYear(1955), "1950s");
  assert.equal(Core.periodForYear(1963), "1960s");
  assert.equal(Core.periodForYear(1989), "1980s");
  assert.equal(Core.periodForYear(1999), "1999");
  assert.equal(Core.periodForYear(2000), "2000");
  assert.equal(Core.periodForYear(2030), "2030");
});

test("seasonForDate maps months to the four Japanese TV seasons", () => {
  assert.equal(Core.seasonForDate("2023-01-06"), "1");
  assert.equal(Core.seasonForDate("2023-04-01"), "4");
  assert.equal(Core.seasonForDate("2023-09-30"), "7");
  assert.equal(Core.seasonForDate("2023-12-15"), "10");
  assert.equal(Core.seasonForDate(""), null);
});

test("filterAnime applies period, season, type and normalized search", () => {
  const items = [
    Core.normalizeAnime({ id: "a", title: "名侦探 柯南", year: 2023, type: "movie" }),
    Core.normalizeAnime({ id: "b", title: "测试动画", originalTitle: "TEST ANIME", year: 2023, type: "tv", season: "4" }),
    Core.normalizeAnime({ id: "c", title: "旧作", year: 1998, type: "ova" }),
  ];
  assert.deepEqual(Core.filterAnime(items, { period: "2023", season: "4", type: "tv", query: "test anime" }).map((item) => item.id), ["b"]);
  assert.deepEqual(Core.filterAnime(items, { period: "1998", season: "all", type: "other", query: "" }).map((item) => item.id), ["c"]);
  assert.equal(items[2].type, "other");
});

test("filterAnime also finds alternate titles", () => {
  const item = Core.normalizeAnime({ id: "bgm-309311", title: "赛博浪客", originalTitle: "Cyberpunk: Edgerunners", aliases: ["赛博朋克：边缘行者"], year: 2022, type: "web" });
  assert.equal(Core.filterAnime([item], { period: "all", season: "all", type: "all", query: "赛博朋克边缘行者" }).length, 1);
  assert.equal(item.type, "web");
});

test("collectionStats counts years and categories", () => {
  const stats = Core.collectionStats([
    Core.normalizeAnime({ id: "a", title: "A", year: 2001, type: "tv" }),
    Core.normalizeAnime({ id: "b", title: "B", year: 2001, type: "movie" }),
    Core.normalizeAnime({ id: "c", title: "C", year: 2023, type: "other" }),
  ]);
  assert.equal(stats.total, 3);
  assert.equal(stats.years, 2);
  assert.equal(stats.earliest, 2001);
  assert.equal(stats.latest, 2023);
  assert.equal(stats.types.movie, 1);
  assert.equal(stats.types.other, 1);
});

test("sortAnime can sort independently by Bangumi vote count", () => {
  const items = [
    Core.normalizeAnime({ id: "a", title: "A", year: 2020, voteCount: 12, score: 9 }),
    Core.normalizeAnime({ id: "b", title: "B", year: 2020, voteCount: 500, score: 7 }),
  ];
  assert.deepEqual(Core.sortAnime(items, "votes").map((item) => item.id), ["b", "a"]);
  assert.deepEqual(Core.sortAnime(items, "votes", "asc").map((item) => item.id), ["a", "b"]);
  assert.deepEqual(Core.sortAnime(items, "votes", "desc").map((item) => item.id), ["b", "a"]);
});

test("sortAnime maps asc to low/early/A-Z and desc to high/late/Z-A", () => {
  const items = [
    Core.normalizeAnime({ id: "a", title: "A", year: 2020, releaseDate: "2020-01-01", voteCount: 10, score: 6 }),
    Core.normalizeAnime({ id: "b", title: "B", year: 2021, releaseDate: "2021-01-01", voteCount: 20, score: 8 }),
  ];
  assert.deepEqual(Core.sortAnime(items, "date", "asc").map((item) => item.id), ["a", "b"]);
  assert.deepEqual(Core.sortAnime(items, "date", "desc").map((item) => item.id), ["b", "a"]);
  assert.deepEqual(Core.sortAnime(items, "score", "asc").map((item) => item.id), ["a", "b"]);
  assert.deepEqual(Core.sortAnime(items, "score", "desc").map((item) => item.id), ["b", "a"]);
  assert.deepEqual(Core.sortAnime(items, "title", "asc").map((item) => item.id), ["a", "b"]);
  assert.deepEqual(Core.sortAnime(items, "title", "desc").map((item) => item.id), ["b", "a"]);
});

test("normalizeAnime preserves null scores and three record reactions", () => {
  const item = Core.normalizeAnime({
    id: "reaction",
    title: "R",
    year: 2020,
    score: null,
    reaction: "recommended",
    bangumiTags: [{ name: "TV", count: 20 }, { name: "日本", count: 10 }, { name: "原创", count: null }],
    bangumiTagTotal: 1480,
    bangumiOrdinaryTag: { name: "运动", count: 94 },
  });
  assert.equal(item.score, null);
  assert.equal(item.reaction, "recommended");
  assert.deepEqual(item.bangumiTags.map((tag) => tag.name), ["TV", "原创"]);
  assert.equal(item.bangumiTags[1].count, null);
  assert.equal(item.bangumiTagTotal, 1480);
  assert.deepEqual(item.bangumiOrdinaryTag, { name: "运动", count: 94 });
});

test("normalizeAnime keeps runtime and theatrical audit metadata", () => {
  const item = Core.normalizeAnime({
    id: "audit-1",
    title: "审查示例",
    year: 2023,
    type: "ova",
    runtimeText: "53分钟",
    runtimeMinutes: 53,
    episodeCount: 1,
    theatricalStatus: "confirmed",
    theatricalReleaseDates: ["2023年1月20日"],
    homeVideoReleaseDates: ["2023年5月17日"],
    bangumiPlatform: 2,
  });
  assert.equal(item.runtimeMinutes, 53);
  assert.equal(item.episodeCount, 1);
  assert.equal(item.theatricalStatus, "confirmed");
  assert.deepEqual(item.theatricalReleaseDates, ["2023年1月20日"]);
  assert.equal(item.bangumiPlatform, 2);
});

test("normalizeAnime keeps compilation metadata for catalog folding", () => {
  const item = Core.normalizeAnime({
    id: "recap",
    title: "某作品总集篇",
    year: 2024,
    type: "other",
    classificationKind: "summary",
  });
  assert.equal(item.isCompilation, true);
  assert.equal(item.classificationKind, "summary");
});

test("Chinese archive records keep undated state and the complete tag layer", () => {
  const item = Core.normalizeAnime({
    id: "bgm-cn-test",
    title: "待定国产动画",
    year: null,
    origin: "cn",
    type: "other",
    preliminaryType: "web",
    preliminaryTypeLabel: "Web",
    bangumiTags: [{ name: "中国", count: 30 }],
    bangumiAllTags: [
      { name: "中国", count: 30, public: true },
      { name: "水墨", count: 4, public: false },
    ],
  });
  assert.equal(item.year, null);
  assert.equal(item.period, "undated");
  assert.equal(item.origin, "cn");
  assert.equal(item.bangumiAllTags.length, 2);
  assert.equal(Core.matchesPeriod(item, "undated"), true);
  assert.equal(Core.matchesPeriod(item, "2020"), false);
});
