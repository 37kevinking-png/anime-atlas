(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AnimeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TYPES = [
    { key: "all", label: "全部类型" },
    { key: "tv", label: "TV动画" },
    { key: "web", label: "WEB动画" },
    { key: "movie", label: "动画电影" },
    { key: "theatrical", label: "剧场版" },
    { key: "other", label: "其他" },
  ];

  const REACTIONS = [
    { key: "watched", label: "看过", emoji: "✓" },
    { key: "recommended", label: "推荐", emoji: "❤️" },
    { key: "difficult", label: "一言难尽", emoji: "😵‍💫" },
  ];

  const SEASONS = [
    { key: "all", label: "全部季度" },
    { key: "1", label: "1月番" },
    { key: "4", label: "4月番" },
    { key: "7", label: "7月番" },
    { key: "10", label: "10月番" },
  ];

  const PERIODS = [
    { key: "pre1950", label: "50年代前", shortLabel: "50年代前", start: 1917, end: 1949, kind: "era" },
    { key: "1950s", label: "50年代", shortLabel: "50s", start: 1950, end: 1959, kind: "decade" },
    { key: "1960s", label: "60年代", shortLabel: "60s", start: 1960, end: 1969, kind: "decade" },
    { key: "1970s", label: "70年代", shortLabel: "70s", start: 1970, end: 1979, kind: "decade" },
    { key: "1980s", label: "80年代", shortLabel: "80s", start: 1980, end: 1989, kind: "decade" },
    ...Array.from({ length: 41 }, (_, index) => {
      const year = 1990 + index;
      return {
        key: String(year),
        label: `${year}年`,
        shortLabel: String(year),
        start: year,
        end: year,
        kind: "year",
      };
    }),
  ];

  const TYPE_KEYS = new Set(TYPES.slice(1).map((item) => item.key));
  const SEASON_KEYS = new Set(SEASONS.slice(1).map((item) => item.key));

  function periodForYear(year) {
    const numericYear = Number(year);
    if (!Number.isInteger(numericYear)) return "";
    if (numericYear >= 1917 && numericYear < 1950) return "pre1950";
    if (numericYear >= 1950 && numericYear < 1990) {
      return `${Math.floor(numericYear / 10) * 10}s`;
    }
    return String(numericYear);
  }

  function seasonForDate(dateValue) {
    if (!dateValue) return null;
    const match = String(dateValue).match(/^\d{4}-(\d{1,2})/);
    if (!match) return null;
    const month = Number(match[1]);
    if (month >= 1 && month <= 3) return "1";
    if (month >= 4 && month <= 6) return "4";
    if (month >= 7 && month <= 9) return "7";
    if (month >= 10 && month <= 12) return "10";
    return null;
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("zh-CN")
      .replace(/[\s\p{P}\p{S}]+/gu, "");
  }

  function normalizeAnime(item, fallbackIndex = 0) {
    const source = item && typeof item === "object" ? item : {};
    const parsedYear = Number.parseInt(source.year, 10);
    const year = Number.isInteger(parsedYear) && parsedYear >= 1917 && parsedYear <= 2030
      ? parsedYear
      : null;
    const migratedType = source.type === "ova" ? "other" : source.type;
    const type = TYPE_KEYS.has(migratedType) ? migratedType : "tv";
    const derivedSeason = seasonForDate(source.releaseDate || source.airDate);
    const season = type === "tv"
      ? (SEASON_KEYS.has(String(source.season)) ? String(source.season) : derivedSeason || "1")
      : null;
    const title = String(source.title || source.name || "未命名作品").trim();
    const id = String(source.id || `manual-${year || "undated"}-${fallbackIndex}-${normalizeText(title) || "anime"}`);

    return {
      id,
      title,
      originalTitle: String(source.originalTitle || "").trim(),
      aliases: Array.isArray(source.aliases) ? source.aliases.map((value) => String(value).trim()).filter(Boolean) : [],
      year,
      period: year ? periodForYear(year) : "undated",
      season,
      type,
      poster: String(source.poster || "").trim(),
      releaseDate: String(source.releaseDate || source.airDate || "").trim(),
      studio: String(source.studio || "").trim(),
      note: String(source.note || "").trim(),
      score: source.score !== null && source.score !== "" && Number.isFinite(Number(source.score))
        ? Number(source.score)
        : null,
      rank: source.rank !== null && source.rank !== "" && Number.isFinite(Number(source.rank)) && Number(source.rank) > 0
        ? Number(source.rank)
        : null,
      voteCount: source.voteCount !== null && source.voteCount !== "" && Number.isFinite(Number(source.voteCount))
        ? Math.max(0, Number(source.voteCount))
        : 0,
      rankingEligible: Boolean(source.rankingEligible),
      source: Array.isArray(source.source) ? source.source : [],
      runtimeText: String(source.runtimeText || "").trim(),
      runtimeMinutes: Number.isFinite(Number(source.runtimeMinutes)) ? Number(source.runtimeMinutes) : null,
      episodeCount: Number.isFinite(Number(source.episodeCount)) && Number(source.episodeCount) > 0
        ? Number(source.episodeCount)
        : null,
      theatricalStatus: ["confirmed", "probable", "not_listed", "unknown"].includes(source.theatricalStatus)
        ? source.theatricalStatus
        : "",
      theatricalReleaseDates: Array.isArray(source.theatricalReleaseDates) ? source.theatricalReleaseDates : [],
      otherTheatricalReleaseDates: Array.isArray(source.otherTheatricalReleaseDates)
        ? source.otherTheatricalReleaseDates
        : [],
      homeVideoReleaseDates: Array.isArray(source.homeVideoReleaseDates) ? source.homeVideoReleaseDates : [],
      hasInternationalRelease: Boolean(source.hasInternationalRelease),
      bangumiPlatform: Number.isFinite(Number(source.bangumiPlatform)) ? Number(source.bangumiPlatform) : null,
      classificationReason: String(source.classificationReason || "").trim(),
      classificationKind: String(source.classificationKind || "").trim(),
      isCompilation: Boolean(source.isCompilation)
        || String(source.classificationKind || "").trim() === "summary"
        || /总集|總集|総集|合集|recap/i.test(String(source.title || "")),
      bangumiTags: Array.isArray(source.bangumiTags)
        ? source.bangumiTags
          .map((tag) => ({
            name: String(tag?.name || "").trim(),
            count: tag?.count !== null && tag?.count !== "" && Number.isFinite(Number(tag?.count))
              ? Math.max(0, Number(tag.count))
              : null,
          }))
          .filter((tag) => tag.name && tag.name !== "日本")
        : [],
      bangumiOrdinaryTag: source.bangumiOrdinaryTag && typeof source.bangumiOrdinaryTag === "object"
        ? {
            name: String(source.bangumiOrdinaryTag.name || "").trim(),
            count: source.bangumiOrdinaryTag.count !== null && source.bangumiOrdinaryTag.count !== "" && Number.isFinite(Number(source.bangumiOrdinaryTag.count))
              ? Math.max(0, Number(source.bangumiOrdinaryTag.count))
              : null,
          }
        : null,
      chineseCategoryKey: ["cn-tv", "cn-web", "cn-movie", "cn-other"].includes(source.chineseCategoryKey)
        ? source.chineseCategoryKey
        : "",
      bangumiTagTotal: Number.isFinite(Number(source.bangumiTagTotal))
        ? Math.max(0, Number(source.bangumiTagTotal))
        : 0,
      bangumiAllTags: Array.isArray(source.bangumiAllTags)
        ? source.bangumiAllTags
          .map((tag) => ({
            name: String(tag?.name || "").trim(),
            count: tag?.count !== null && tag?.count !== "" && Number.isFinite(Number(tag?.count))
              ? Math.max(0, Number(tag.count))
              : null,
            public: Boolean(tag?.public),
          }))
          .filter((tag) => tag.name)
        : [],
      origin: source.origin === "cn" ? "cn" : "jp",
      originLabel: String(source.originLabel || (source.origin === "cn" ? "国产候选" : "日本动画")).trim(),
      classificationPending: Boolean(source.classificationPending),
      preliminaryType: String(source.preliminaryType || "").trim(),
      preliminaryTypeLabel: String(source.preliminaryTypeLabel || "").trim(),
      dateUnknown: Boolean(source.dateUnknown) || !year,
      rawScore: source.rawScore !== null && source.rawScore !== "" && Number.isFinite(Number(source.rawScore))
        ? Number(source.rawScore)
        : null,
      countryEvidenceTags: Array.isArray(source.countryEvidenceTags)
        ? source.countryEvidenceTags.map((tag) => String(tag || "").trim()).filter(Boolean)
        : [],
      reaction: REACTIONS.some((reaction) => reaction.key === source.reaction) ? source.reaction : "watched",
      custom: Boolean(source.custom),
      addedAt: source.addedAt || null,
    };
  }

  function matchesPeriod(item, periodKey) {
    if (!periodKey || periodKey === "all") return true;
    if (periodKey === "undated") return !Number.isInteger(item.year);
    const period = PERIODS.find((candidate) => candidate.key === periodKey);
    if (!period || !Number.isInteger(item.year)) return false;
    return item.year >= period.start && item.year <= period.end;
  }

  function filterAnime(items, filters) {
    const query = normalizeText(filters.query || "");
    return items.filter((item) => {
      if (!matchesPeriod(item, filters.period)) return false;
      if (filters.type && filters.type !== "all" && item.type !== filters.type) return false;
      if (filters.season && filters.season !== "all") {
        if (item.type !== "tv" || item.season !== String(filters.season)) return false;
      }
      if (query) {
        const haystack = normalizeText(
          [
            item.title,
            item.originalTitle,
            ...item.aliases,
            item.studio,
            item.note,
            item.preliminaryTypeLabel,
            ...item.bangumiTags.map((tag) => tag.name),
            ...item.bangumiAllTags.map((tag) => tag.name),
          ].filter(Boolean).join(" ")
        );
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function sortAnime(items, sortKey, direction) {
    const copy = [...items];
    const resolvedDirection = direction === "asc" || direction === "desc"
      ? direction
      : ["score", "votes"].includes(sortKey) ? "desc" : "asc";
    const factor = resolvedDirection === "asc" ? 1 : -1;
    const titleCompare = (a, b) => a.title.localeCompare(b.title, "zh-CN") * factor;
    const nullableNumberCompare = (a, b, field) => {
      const valueA = Number.isFinite(a[field]) ? a[field] : null;
      const valueB = Number.isFinite(b[field]) ? b[field] : null;
      if (valueA === null && valueB === null) return 0;
      if (valueA === null) return 1;
      if (valueB === null) return -1;
      return (valueA - valueB) * factor;
    };
    if (sortKey === "score") {
      return copy.sort((a, b) => nullableNumberCompare(a, b, "score") || (a.voteCount - b.voteCount) * factor || titleCompare(a, b));
    }
    if (sortKey === "votes") return copy.sort((a, b) => (a.voteCount - b.voteCount) * factor || nullableNumberCompare(a, b, "score") || titleCompare(a, b));
    if (sortKey === "title") return copy.sort(titleCompare);
    return copy.sort((a, b) => {
      const dateA = a.releaseDate || (a.year ? `${a.year}-12-31` : "");
      const dateB = b.releaseDate || (b.year ? `${b.year}-12-31` : "");
      if (!dateA && !dateB) return titleCompare(a, b);
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA.localeCompare(dateB) * factor || titleCompare(a, b);
    });
  }

  function cellKey(item) {
    if (item.type === "tv") return `season-${item.season || "1"}`;
    return item.type;
  }

  function collectionStats(items) {
    const years = new Set(items.map((item) => item.year).filter(Number.isInteger));
    const types = Object.fromEntries(TYPES.slice(1).map((type) => [type.key, 0]));
    items.forEach((item) => {
      if (Object.hasOwn(types, item.type)) types[item.type] += 1;
    });
    return {
      total: items.length,
      years: years.size,
      earliest: years.size ? Math.min(...years) : null,
      latest: years.size ? Math.max(...years) : null,
      types,
    };
  }

  function safeFileName(value) {
    return String(value || "anime-history")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80);
  }

  return {
    TYPES,
    REACTIONS,
    SEASONS,
    PERIODS,
    periodForYear,
    seasonForDate,
    normalizeText,
    normalizeAnime,
    matchesPeriod,
    filterAnime,
    sortAnime,
    cellKey,
    collectionStats,
    safeFileName,
  };
});
