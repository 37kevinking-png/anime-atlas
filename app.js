(function () {
  "use strict";

  const Core = window.AnimeCore;
  const STORAGE_KEY = "anime-atlas:collection:v1";
  const THEME_LIST_STORAGE_KEY = "anime-atlas:theme-lists:v1";
  const SWIPE_SKIPPED_STORAGE_KEY = "anime-atlas:swipe-skipped:v1";
  const SWIPE_FILTERS_STORAGE_KEY = "anime-atlas:swipe-filters:v1";
  const currentYear = Math.min(2030, new Date().getFullYear());
  let deletedThemeIds = new Set();
  const SWIPE_VOTE_PRESETS = new Set([30, 100, 500, 1000]);
  const SWIPE_DEFAULT_FILTERS = Object.freeze({
    startYear: 1917,
    minVotes: 30,
    minScore: 0,
    maxScore: 10,
    excludeChinese: false,
    excludeWeb: false,
    excludeMovie: false,
    excludeTheatrical: false,
    excludeCompilation: false,
    excludeOther: false,
  });
  const SHARE_FILE_PREFIX = "番迹-动画生涯个人喜好表";
  const TAG_STATS_EXCLUSIONS = new Set(["tv", "电视动画", "剧场版", "动画电影", "電影", "电影", "movie", "ova", "oad", "web", "其他"]);
  const CATALOG_TAG_DISPLAY_EXCLUSIONS = new Set([
    "tv", "tv动画", "电视动画", "テレビアニメ", "web", "ova", "oad",
    "剧场版", "劇場版", "动画电影", "動畫電影", "アニメ映画", "电影", "電影", "映画", "movie",
    "其他", "日本", "日本动画", "日本動畫", "中国", "中國", "国产", "國產",
  ]);
  const WORD_CLOUD_SHAPES = [
    { key: "cat", label: "猫猫" },
    { key: "cloud", label: "云朵" },
    { key: "heart", label: "爱心" },
    { key: "lightning", label: "电光" },
    { key: "sakura", label: "樱花" },
    { key: "magic", label: "魔法阵" },
    { key: "moonwing", label: "月翼" },
    { key: "title", label: "番迹字标" },
  ];
  const DEFAULT_THEME_LISTS = [
    { id: "entry", group: "起点与影响", title: "入坑作", icon: "🚪", kicker: "THE FIRST STEP", description: "真正把你带进动画世界的那部作品。", layout: "origin", syncCareer: true },
    { id: "childhood", group: "起点与影响", title: "童年白月光", icon: "🌙", kicker: "CHILDHOOD LIGHT", description: "多年以后想起，依然带着童年滤镜的作品。", layout: "origin", syncCareer: true },
    { id: "xp", group: "起点与影响", title: "XP 启蒙", icon: "⚡", kicker: "TASTE AWAKENED", description: "悄悄塑造了你的角色审美与偏好。", layout: "origin", syncCareer: true },
    { id: "first_cp", group: "起点与影响", title: "磕的第一对 CP", icon: "💞", kicker: "FIRST SHIP", description: "第一次真情实感磕上的那对角色。", layout: "origin", syncCareer: true, notes: true },
    { id: "influence", group: "起点与影响", title: "影响深远", icon: "🧭", kicker: "CHANGED ME", description: "它改变了你的想法、选择或看世界的方式。", layout: "origin", syncCareer: true },

    { id: "favorites", group: "私人偏爱", title: "本命神作", icon: "👑", kicker: "HALL OF FAME", description: "不必客观，只选那些在你心里不可替代的作品。", layout: "favorite", syncCareer: true },
    { id: "recommend", group: "私人偏爱", title: "最想安利", icon: "💌", kicker: "SHARE THE LOVE", description: "恨不得立刻塞给朋友看的作品。", layout: "favorite", syncCareer: true },
    { id: "hidden_gem", group: "私人偏爱", title: "冷门宝藏", icon: "💎", kicker: "HIDDEN GEM", description: "看过的人不算多，却值得被更多人发现。", layout: "favorite", syncCareer: true },
    { id: "worst", group: "私人偏爱", title: "最雷", icon: "💥", kicker: "DANGER ZONE", description: "踩过的雷也值得留下警示牌。", layout: "favorite", syncCareer: true, notes: true },
    { id: "rewatch", group: "私人偏爱", title: "最想重看", icon: "🔁", kicker: "ONE MORE TIME", description: "只要再打开一次，可能又会从头看到尾。", layout: "favorite", syncCareer: true },

    { id: "comfort", group: "情绪共振", title: "舒适区", icon: "☁️", kicker: "COMFORT ZONE", description: "低落、疲惫或只想放松时，会让你觉得舒服的作品。", layout: "emotion", syncCareer: true, notes: true },
    { id: "funniest", group: "情绪共振", title: "笑得最开心", icon: "😆", kicker: "BEST LAUGH", description: "让你笑到暂停、倒回去再看一次。", layout: "emotion", syncCareer: true },
    { id: "tearjerker", group: "情绪共振", title: "哭得最狠", icon: "😭", kicker: "UGLY CRY", description: "眼泪完全不讲道理地决堤。", layout: "emotion", syncCareer: true },
    { id: "bittersweet", group: "情绪共振", title: "最大意难平", icon: "🌧️", kicker: "UNFINISHED FEELINGS", description: "烂尾、腰斩、角色结局或没有续作，都是放不下的理由。", layout: "emotion", syncCareer: true, notes: true },
    { id: "aftertaste", group: "情绪共振", title: "久久走不出来", icon: "🌌", kicker: "STILL THINKING", description: "完结很久以后，情绪和画面仍留在脑海里。", layout: "emotion", syncCareer: true },

    { id: "best_animation", group: "审美高光", title: "最强作画", icon: "✏️", kicker: "BEST ANIMATION", description: "动作、表情或细节让你忍不住逐帧看。", layout: "craft", syncCareer: true },
    { id: "best_direction", group: "审美高光", title: "最强演出", icon: "🎬", kicker: "BEST DIRECTION", description: "镜头、节奏和视听设计真正改变了叙事。", layout: "craft", syncCareer: true },
    { id: "best_music", group: "审美高光", title: "最强音乐", icon: "🎧", kicker: "BEST MUSIC", description: "OP、ED、配乐或插曲一响就能把你拉回作品。", layout: "craft", syncCareer: true },
    { id: "best_world", group: "审美高光", title: "最爱世界观", icon: "🪐", kicker: "BEST WORLD", description: "最想继续探索、甚至亲自住进去的世界。", layout: "craft", syncCareer: true },
    { id: "best_character", group: "审美高光", title: "最爱角色塑造", icon: "🎭", kicker: "BEST CHARACTERS", description: "角色弧光、关系和成长最让你信服。", layout: "craft", syncCareer: true },

    { id: "annual", group: "特别企划", title: "年度十佳", icon: "🏆", kicker: "ANNUAL TOP TEN", description: "选择一个年份，从当年作品中留下最多十部个人代表作。", layout: "annual", syncCareer: true, annual: true, maxItems: 10 },
  ];
  const TYPE_LABELS = Object.fromEntries(Core.TYPES.map((item) => [item.key, item.label]));
  const SEASON_LABELS = Object.fromEntries(Core.SEASONS.map((item) => [item.key, item.label]));
  const CHINESE_TYPES = [
    { key: "all", label: "全部类型" },
    { key: "cn-tv", label: "TV动画" },
    { key: "cn-web", label: "WEB动画" },
    { key: "cn-movie", label: "动画电影" },
    { key: "cn-other", label: "其他 / 待分类" },
  ];

  const elements = {
    navButtons: [...document.querySelectorAll("[data-view]")],
    homeBrand: document.querySelector("#homeBrand"),
    originSwitchShell: document.querySelector("#originSwitchShell"),
    originSwitch: document.querySelector("#originSwitch"),
    originButtons: [...document.querySelectorAll("[data-origin]")],
    japaneseCatalogCount: document.querySelector("#japaneseCatalogCount"),
    chineseCatalogCount: document.querySelector("#chineseCatalogCount"),
    timelineShell: document.querySelector(".timeline-shell"),
    browseView: document.querySelector("#browseView"),
    swipeView: document.querySelector("#swipeView"),
    collectionView: document.querySelector("#collectionView"),
    themesView: document.querySelector("#themesView"),
    annualView: document.querySelector("#annualView"),
    catalogCount: document.querySelector("#catalogCount"),
    catalogTypeStats: document.querySelector("#catalogTypeStats"),
    selectedCount: document.querySelector("#selectedCount"),
    selectedTypeStats: document.querySelector("#selectedTypeStats"),
    headerSelectedCount: document.querySelector("#headerSelectedCount"),
    timelineTitle: document.querySelector("#timelineTitle"),
    timeline: document.querySelector("#timeline"),
    timelinePrev: document.querySelector("#timelinePrev"),
    timelineNext: document.querySelector("#timelineNext"),
    timelineYearInput: document.querySelector("#timelineYearInput"),
    timelineYearJump: document.querySelector("#timelineYearJump"),
    activePeriodLabel: document.querySelector("#activePeriodLabel"),
    activePeriodKind: document.querySelector("#activePeriodKind"),
    browseSummary: document.querySelector("#browseSummary"),
    searchInput: document.querySelector("#searchInput"),
    mobileFilterToggle: document.querySelector("#mobileFilterToggle"),
    catalogModeGroup: document.querySelector("#catalogModeGroup"),
    catalogModeFilters: document.querySelector("#catalogModeFilters"),
    catalogModeButtons: [...document.querySelectorAll("[data-catalog-mode]")],
    tvSeasonRow: document.querySelector("#tvSeasonRow"),
    seasonFilters: document.querySelector("#seasonFilters"),
    typeFilters: document.querySelector("#typeFilters"),
    typeFilterGroup: document.querySelector("#typeFilterGroup"),
    sortSelect: document.querySelector("#sortSelect"),
    sortDirection: document.querySelector("#sortDirection"),
    clearFilters: document.querySelector("#clearFilters"),
    resultCount: document.querySelector("#resultCount"),
    foldedCount: document.querySelector("#foldedCount"),
    lowVoteToggle: document.querySelector("#lowVoteToggle"),
    compilationToggle: document.querySelector("#compilationToggle"),
    posterGrid: document.querySelector("#posterGrid"),
    monthlyCatalog: document.querySelector("#monthlyCatalog"),
    catalogLoadMore: document.querySelector("#catalogLoadMore"),
    catalogEmpty: document.querySelector("#catalogEmpty"),
    openSelection: document.querySelector("#openSelection"),
    selectionDrawer: document.querySelector("#selectionDrawer"),
    drawerList: document.querySelector("#drawerList"),
    collectionOverview: document.querySelector("#collectionOverview"),
    collectionInsights: document.querySelector("#collectionInsights"),
    collectionGrouping: document.querySelector(".collection-grouping"),
    collectionTypeFilters: document.querySelector("#collectionTypeFilters"),
    collectionSeasonRow: document.querySelector("#collectionSeasonRow"),
    collectionSeasonFilters: document.querySelector("#collectionSeasonFilters"),
    collectionFilterCount: document.querySelector("#collectionFilterCount"),
    collectionFilterScope: document.querySelector("#collectionFilterScope"),
    clearCollectionFilters: document.querySelector("#clearCollectionFilters"),
    collectionGallery: document.querySelector("#collectionGallery"),
    collectionTablePanel: document.querySelector("#collectionTablePanel"),
    collectionModeButtons: [...document.querySelectorAll("[data-collection-mode]")],
    swipePanel: document.querySelector("#swipePanel"),
    swipeDeck: document.querySelector("#swipeDeck"),
    undoSwipeDecision: document.querySelector("#undoSwipeDecision"),
    swipeActions: document.querySelector(".swipe-actions"),
    resetSwipeSkipped: document.querySelector("#resetSwipeSkipped"),
    swipeStartYear: document.querySelector("#swipeStartYear"),
    swipeStartYearValue: document.querySelector("#swipeStartYearValue"),
    swipeMinVotesPreset: document.querySelector("#swipeMinVotesPreset"),
    swipeMinVotesCustom: document.querySelector("#swipeMinVotesCustom"),
    swipeMinVotesCustomField: document.querySelector("#swipeMinVotesCustomField"),
    swipeMinScore: document.querySelector("#swipeMinScore"),
    swipeMinScoreValue: document.querySelector("#swipeMinScoreValue"),
    swipeMaxScore: document.querySelector("#swipeMaxScore"),
    swipeMaxScoreValue: document.querySelector("#swipeMaxScoreValue"),
    swipeExcludeChinese: document.querySelector("#swipeExcludeChinese"),
    swipeExcludeWeb: document.querySelector("#swipeExcludeWeb"),
    swipeExcludeMovie: document.querySelector("#swipeExcludeMovie"),
    swipeExcludeTheatrical: document.querySelector("#swipeExcludeTheatrical"),
    swipeExcludeCompilation: document.querySelector("#swipeExcludeCompilation"),
    swipeExcludeOther: document.querySelector("#swipeExcludeOther"),
    swipeFilterPanel: document.querySelector("#swipeFilterPanel"),
    swipeFilterSummary: document.querySelector("#swipeFilterSummary"),
    applySwipeFilters: document.querySelector("#applySwipeFilters"),
    resetSwipeFilters: document.querySelector("#resetSwipeFilters"),
    historyTableBody: document.querySelector("#historyTableBody"),
    exportButton: document.querySelector("#exportButton"),
    importButton: document.querySelector("#importButton"),
    importInput: document.querySelector("#importInput"),
    clearCollection: document.querySelector("#clearCollection"),
    openManualAdd: document.querySelector("#openManualAdd"),
    manualDialog: document.querySelector("#manualDialog"),
    manualForm: document.querySelector("#manualForm"),
    manualYear: document.querySelector("#manualYear"),
    manualType: document.querySelector("#manualType"),
    manualSeasonField: document.querySelector("#manualSeasonField"),
    manualSeason: document.querySelector("#manualSeason"),
    themeMatrix: document.querySelector("#themeMatrix"),
    themeWorkbench: document.querySelector("#themeWorkbench"),
    themeIcon: document.querySelector("#themeIcon"),
    themeKicker: document.querySelector("#themeKicker"),
    themeTitle: document.querySelector("#themeTitle"),
    themeDescription: document.querySelector("#themeDescription"),
    themeCareerSync: document.querySelector("#themeCareerSync"),
    themeSearchInput: document.querySelector("#themeSearchInput"),
    themeSearchHelp: document.querySelector("#themeSearchHelp"),
    themeSearchResults: document.querySelector("#themeSearchResults"),
    themeItemCount: document.querySelector("#themeItemCount"),
    themeEmptyHint: document.querySelector("#themeEmptyHint"),
    themeGallery: document.querySelector("#themeGallery"),
    browseForTheme: document.querySelector("#browseForTheme"),
    openCustomTheme: document.querySelector("#openCustomTheme"),
    clearThemes: document.querySelector("#clearThemes"),
    customThemeDialog: document.querySelector("#customThemeDialog"),
    customThemeForm: document.querySelector("#customThemeForm"),
    annualPageYear: document.querySelector("#annualPageYear"),
    annualSelectedYear: document.querySelector("#annualSelectedYear"),
    annualSelectedCount: document.querySelector("#annualSelectedCount"),
    annualSelectedGrid: document.querySelector("#annualSelectedGrid"),
    annualCareerSync: document.querySelector("#annualCareerSync"),
    annualSearchInput: document.querySelector("#annualSearchInput"),
    annualCatalogTitle: document.querySelector("#annualCatalogTitle"),
    annualCatalogCount: document.querySelector("#annualCatalogCount"),
    annualCatalogGrid: document.querySelector("#annualCatalogGrid"),
    annualLoadMore: document.querySelector("#annualLoadMore"),
    annualOriginFilters: document.querySelector("#annualOriginFilters"),
    annualTypeFilters: document.querySelector("#annualTypeFilters"),
    annualSeasonRow: document.querySelector("#annualSeasonRow"),
    annualSeasonFilters: document.querySelector("#annualSeasonFilters"),
    annualSortSelect: document.querySelector("#annualSortSelect"),
    annualSortDirection: document.querySelector("#annualSortDirection"),
    exportAnnualImage: document.querySelector("#exportAnnualImage"),
    clearAnnualYear: document.querySelector("#clearAnnualYear"),
    confirmClearDialog: document.querySelector("#confirmClearDialog"),
    confirmClearTitle: document.querySelector("#confirmClearTitle"),
    confirmClearMessage: document.querySelector("#confirmClearMessage"),
    closeConfirmClear: document.querySelector("#closeConfirmClear"),
    cancelClearAction: document.querySelector("#cancelClearAction"),
    confirmClearAction: document.querySelector("#confirmClearAction"),
    openShareStudio: document.querySelector("#openShareStudio"),
    shareDialog: document.querySelector("#shareDialog"),
    closeShareDialog: document.querySelector("#closeShareDialog"),
    shareShowEmpty: document.querySelector("#shareShowEmpty"),
    shareIncludeNotes: document.querySelector("#shareIncludeNotes"),
    generateShareImages: document.querySelector("#generateShareImages"),
    downloadShareImages: document.querySelector("#downloadShareImages"),
    shareStatus: document.querySelector("#shareStatus"),
    sharePreviewList: document.querySelector("#sharePreviewList"),
    toast: document.querySelector("#toast"),
    themeQuickMenu: document.querySelector("#themeQuickMenu"),
    themeQuickMenuTitle: document.querySelector("#themeQuickMenuTitle"),
    themeQuickMenuItems: document.querySelector("#themeQuickMenuItems"),
    backToTop: document.querySelector("#backToTop"),
  };

  const japaneseCatalog = dedupeCatalog((window.ANIME_DATA || []).map((item, index) => Core.normalizeAnime({ ...item, origin: "jp" }, index)))
    .filter(isCurrentOrPastYear);
  const allChineseCatalog = dedupeCatalog((window.ANIME_CN_DATA || []).map((item, index) => Core.normalizeAnime({ ...item, origin: "cn" }, japaneseCatalog.length + index)))
    .filter(isCurrentOrPastYear);
  const chineseCatalog = allChineseCatalog.filter((item) => isReleasedChineseItem(item));
  const catalog = dedupeCatalog([...japaneseCatalog, ...chineseCatalog]);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const selected = new Map(loadCollection()
    .map((item, index) => normalizeCollectionItem(item, index))
    .filter(isCurrentOrPastYear)
    .map((item) => [item.id, item]));
  const themeLists = loadThemeLists();
  const swipeSkipped = loadSwipeSkipped();

  const chineseTimelinePeriods = [
    ...Core.PERIODS.filter((period) => period.end < 1990),
    { key: "1990s", label: "90年代", shortLabel: "90s", start: 1990, end: 1999, kind: "decade" },
    ...Core.PERIODS.filter((period) => period.kind === "year" && period.start >= 2000 && period.start <= currentYear),
  ];
  const currentPeriod = Core.PERIODS.find((period) => (
    period.key === String(currentYear)
    && japaneseCatalog.some((item) => Core.matchesPeriod(item, period.key))
  ));
  const latestPopulatedPeriod = currentPeriod || [...Core.PERIODS]
    .reverse()
    .find((period) => period.end <= currentYear && japaneseCatalog.some((item) => Core.matchesPeriod(item, period.key)))
    || [...Core.PERIODS].reverse().find((period) => japaneseCatalog.some((item) => Core.matchesPeriod(item, period.key)));

  const latestChinesePeriod = [...chineseTimelinePeriods]
    .reverse()
    .find((period) => chineseCatalog.some((item) => matchesChinesePeriod(item, period.key)));

  const state = {
    view: "swipe",
    origin: "jp",
    originPeriods: { jp: latestPopulatedPeriod?.key || "2023", cn: latestChinesePeriod?.key || "all" },
    period: latestPopulatedPeriod?.key || "2023",
    season: "all",
    type: "all",
    query: "",
    sort: "votes",
    sortDirection: "desc",
    catalogMode: "poster",
    catalogLimit: 240,
    collapseLowVotes: true,
    collapseCompilations: true,
    originFoldSettings: {
      jp: { lowVotes: true, compilations: true },
      cn: { lowVotes: false, compilations: false },
    },
    collectionMode: "gallery",
    collectionPeriod: "all",
    collectionType: "all",
    collectionSeason: "all",
    activeThemeId: themeLists.find((list) => list.id === "recommend")?.id || themeLists.find((list) => !list.annual)?.id,
    themeQuery: "",
    mobileFiltersExpanded: false,
    swipeQueue: [],
    swipeSessionCount: 0,
    swipeAnimating: false,
    swipeHistory: [],
    swipeFilters: loadSwipeFilters(),
    collectionRecentTenYears: true,
    themeYear: currentYear,
    annualQuery: "",
    annualLimit: 160,
    annualOrigin: "jp",
    annualType: "all",
    annualSeason: "all",
    annualSort: "votes",
    annualSortDirection: "desc",
  };

  let toastTimer = null;
  let shareExports = [];
  let swipePointer = null;
  let pendingClearAction = null;
  let annualDraggedId = null;
  let annualTouchDrag = null;
  let themeDraggedId = null;
  let themeTouchDrag = null;
  let themeSuppressClick = false;
  const shareImageCache = new Map();

  function dedupeCatalog(items) {
    const byId = new Map();
    items.forEach((item) => byId.set(item.id, item));
    return [...byId.values()];
  }

  function isCurrentOrPastYear(item) {
    return !Number.isInteger(item.year) || item.year <= currentYear;
  }

  function normalizeCollectionItem(item, fallbackIndex = 0) {
    const stored = Core.normalizeAnime(item, fallbackIndex);
    const current = catalogById.get(stored.id);
    if (!current || stored.custom) return stored;
    return Core.normalizeAnime({
      ...stored,
      ...current,
      reaction: stored.reaction,
      addedAt: stored.addedAt,
    }, fallbackIndex);
  }

  function loadCollection() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : Array.isArray(parsed.records) ? parsed.records : [];
    } catch (error) {
      console.warn("无法读取本地记录", error);
      return [];
    }
  }

  function loadSwipeSkipped() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SWIPE_SKIPPED_STORAGE_KEY) || "[]");
      return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
    } catch (error) {
      console.warn("无法读取刷番记录", error);
      return new Set();
    }
  }

  function saveSwipeSkipped() {
    try {
      localStorage.setItem(SWIPE_SKIPPED_STORAGE_KEY, JSON.stringify([...swipeSkipped]));
    } catch (error) {
      showToast("浏览器存储空间不足，请先导出备份", "error");
    }
  }

  function loadSwipeFilters() {
    try {
      const saved = JSON.parse(localStorage.getItem(SWIPE_FILTERS_STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...SWIPE_DEFAULT_FILTERS };
      const clamp = (value, minimum, maximum, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
      };
      return {
        startYear: Math.round(clamp(saved.startYear, 1917, currentYear, SWIPE_DEFAULT_FILTERS.startYear)),
        minVotes: Math.round(clamp(saved.minVotes, 0, 1000000, SWIPE_DEFAULT_FILTERS.minVotes)),
        minScore: clamp(saved.minScore, 0, 10, SWIPE_DEFAULT_FILTERS.minScore),
        maxScore: clamp(saved.maxScore, 0, 10, SWIPE_DEFAULT_FILTERS.maxScore),
        excludeChinese: Boolean(saved.excludeChinese),
        excludeWeb: Boolean(saved.excludeWeb),
        excludeMovie: Boolean(saved.excludeMovie),
        excludeTheatrical: Boolean(saved.excludeTheatrical),
        excludeCompilation: Boolean(saved.excludeCompilation),
        excludeOther: Boolean(saved.excludeOther),
      };
    } catch (error) {
      console.warn("无法读取刷刷刷筛选条件", error);
      return { ...SWIPE_DEFAULT_FILTERS };
    }
  }

  function saveSwipeFilters() {
    try {
      localStorage.setItem(SWIPE_FILTERS_STORAGE_KEY, JSON.stringify(state.swipeFilters));
    } catch (error) {
      showToast("浏览器存储空间不足，筛选条件未能保存", "error");
    }
  }

  function loadThemeLists() {
    let stored = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(THEME_LIST_STORAGE_KEY) || "[]");
      stored = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("无法读取主题清单", error);
    }
    const normalizeRecords = (records) => (Array.isArray(records) ? records : [])
        .map((record) => typeof record === "string" ? { id: record } : record)
        .filter((record) => record?.id && catalogById.has(record.id))
        .map((record) => ({
          id: record.id,
          note: String(record.note || "").slice(0, 120),
          bucketYear: Number(record.bucketYear) || null,
          addedAt: record.addedAt || null,
        }));
    deletedThemeIds = new Set(stored
      .filter((list) => list?.deleted && list.id)
      .map((list) => String(list.id)));
    const byId = new Map(stored
      .filter((list) => list?.id && !list.deleted)
      .map((list) => [list.id, list]));
    let lists = DEFAULT_THEME_LISTS
      .filter((preset) => !deletedThemeIds.has(preset.id))
      .map((preset) => {
      const saved = byId.get(preset.id) || {};
      return {
        ...preset,
        maxItems: preset.annual ? preset.maxItems : 1,
        syncCareer: typeof saved.syncCareer === "boolean" ? saved.syncCareer : preset.syncCareer,
        records: normalizeRecords(saved.records),
      };
    });
    stored
      .filter((list) => list?.custom && !list.deleted && list.id && !deletedThemeIds.has(String(list.id)) && !DEFAULT_THEME_LISTS.some((preset) => preset.id === list.id))
      .forEach((list) => lists.push({
        id: String(list.id),
        group: "自定义",
        title: String(list.title || "我的主题").slice(0, 24),
        icon: String(list.icon || "✨").slice(0, 4),
        kicker: "YOUR QUESTION",
        description: String(list.description || "").slice(0, 80),
        layout: "custom",
        syncCareer: Boolean(list.syncCareer),
        custom: true,
        maxItems: 1,
        records: normalizeRecords(list.records),
      }));
    const orderedMain = [];
    const orderedIds = new Set();
    const listsById = new Map(lists.map((list) => [list.id, list]));
    stored
      .filter((list) => list?.id && !list.deleted)
      .forEach((saved) => {
        const id = String(saved.id);
        const list = listsById.get(id);
        if (!list || list.annual || orderedIds.has(id)) return;
        orderedIds.add(id);
        orderedMain.push(list);
      });
    lists = [
      ...orderedMain,
      ...lists.filter((list) => !list.annual && !orderedIds.has(list.id)),
      ...lists.filter((list) => list.annual),
    ];
    return lists;
  }

  function saveThemeLists() {
    try {
      const payload = [
        ...Array.from(deletedThemeIds, (id) => ({ id, deleted: true })),
        ...themeLists.map((list) => ({
          id: list.id,
          syncCareer: list.syncCareer,
          records: list.records,
          ...(list.custom ? {
            custom: true,
            title: list.title,
            icon: list.icon,
            description: list.description,
          } : {}),
        })),
      ];
      localStorage.setItem(THEME_LIST_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      showToast("浏览器存储空间不足，请先导出备份", "error");
    }
  }

  function activeThemeList() {
    return themeLists.find((list) => !list.annual && list.id === state.activeThemeId)
      || themeLists.find((list) => !list.annual);
  }

  function annualThemeList() {
    return themeLists.find((list) => list.annual);
  }

  function mainThemeLists() {
    return themeLists.filter((list) => !list.annual);
  }

  function themeRecord(list, id, year = state.themeYear) {
    return list?.records.find((record) => record.id === id && (!list.annual || record.bucketYear === year)) || null;
  }

  function visibleThemeRecords(list = activeThemeList()) {
    return list.records.filter((record) => !list.annual || record.bucketYear === state.themeYear);
  }


  function saveCollection() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected.values()]));
    } catch (error) {
      showToast("浏览器存储空间不足，请先导出备份", "error");
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function showToast(message, tone = "success", duration = 2600) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.dataset.tone = tone;
    elements.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
  }

  function closeClearConfirmation() {
    pendingClearAction = null;
    if (elements.confirmClearDialog.open) elements.confirmClearDialog.close();
  }

  function openClearConfirmation(kind) {
    const annualCount = visibleThemeRecords(annualThemeList()).length;
    const themeCount = mainThemeLists().reduce((sum, list) => sum + list.records.length, 0);
    const details = {
      collection: {
        count: selected.size,
        empty: "生涯总表现在是空的",
        title: "清空生涯总表？",
        message: `将删除全部 ${selected.size} 条观看记录。喜好图鉴和年度十佳不会被清空，建议先导出备份。`,
      },
      themes: {
        count: themeCount,
        empty: "喜好图鉴现在是空的",
        title: "清空喜好图鉴？",
        message: `将移除全部 ${themeCount} 个主题答案；你自行添加的主题会保留。生涯总表不会被清空。`,
      },
      annual: {
        count: annualCount,
        empty: `${state.themeYear}年度十佳现在是空的`,
        title: `清空${state.themeYear}年度十佳？`,
        message: `将移除 ${state.themeYear} 年已选的全部 ${annualCount} 部作品，其他年份和生涯总表不会受影响。`,
      },
    }[kind];
    if (!details?.count) return showToast(details?.empty || "没有可清空的内容");
    pendingClearAction = kind;
    elements.confirmClearTitle.textContent = details.title;
    elements.confirmClearMessage.textContent = details.message;
    elements.confirmClearDialog.showModal();
    elements.confirmClearAction.focus();
  }

  function confirmClear() {
    if (pendingClearAction === "collection") {
      selected.clear();
      state.swipeHistory = [];
      prepareSwipeQueue(true);
      saveCollection();
      showToast("已清空生涯总表");
    } else if (pendingClearAction === "themes") {
      mainThemeLists().forEach((list) => list.records.splice(0, list.records.length));
      saveThemeLists();
      showToast("已清空喜好图鉴，主题已保留");
    } else if (pendingClearAction === "annual") {
      const list = annualThemeList();
      list.records = list.records.filter((record) => record.bucketYear !== state.themeYear);
      saveThemeLists();
      showToast(`已清空${state.themeYear}年度十佳`);
    } else {
      return;
    }
    closeClearConfirmation();
    renderAll();
  }

  function browseCatalog() {
    return state.origin === "cn" ? chineseCatalog : japaneseCatalog;
  }

  function isReleasedChineseItem(item, now = new Date()) {
    if (item.origin !== "cn") return true;
    const match = String(item.releaseDate || "").match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
    const year = match ? Number(match[1]) : item.year;
    if (!Number.isInteger(year)) return true;
    if (year !== now.getFullYear()) return year < now.getFullYear();
    if (!match?.[2]) return true;
    const month = Number(match[2]);
    if (month !== now.getMonth() + 1) return month < now.getMonth() + 1;
    if (!match[3]) return true;
    return Number(match[3]) <= now.getDate();
  }

  function matchesChinesePeriod(item, periodKey) {
    if (!periodKey || periodKey === "all") return true;
    if (periodKey === "undated") return !Number.isInteger(item.year);
    if (periodKey === "1990s") return Number.isInteger(item.year) && item.year >= 1990 && item.year <= 1999;
    return Core.matchesPeriod(item, periodKey);
  }

  function chineseCategory(item) {
    if (item.origin !== "cn") return null;
    const precomputed = CHINESE_TYPES.find((type) => type.key === item.chineseCategoryKey);
    if (precomputed) return precomputed;
    const tags = new Set((item.bangumiAllTags || item.bangumiTags || [])
      .map((tag) => Core.normalizeText(tag.name)));
    const has = (names) => names.some((name) => tags.has(name));
    // 使用完整标签名，避免“上海美术电影制片厂”之类的制作公司标签误命中“电影”。
    if (has(["动画电影", "動畫電影", "电影", "電影", "电影版", "電影版", "剧场版", "劇場版", "movie"])) {
      return { key: "cn-movie", label: "动画电影" };
    }
    if (has(["tv", "tva", "tv动画", "電視動畫", "电视动画"])) return { key: "cn-tv", label: "TV动画" };
    if (has(["web", "web动画", "网络动画", "網絡動畫", "网播"])) return { key: "cn-web", label: "WEB动画" };
    return { key: "cn-other", label: "其他 / 待分类" };
  }

  function bangumiUrl(item) {
    const direct = (item.source || [])
      .map((source) => ({ name: Core.normalizeText(source.name), url: safeUrl(source.url) }))
      .find((source) => source.url && (source.name.includes("番组计划") || source.name.includes("bangumi")));
    return direct?.url || (item.bangumi_id ? `https://bgm.tv/subject/${encodeURIComponent(item.bangumi_id)}` : "");
  }

  function titleLink(item, className = "anime-title-link") {
    const url = bangumiUrl(item);
    return url
      ? `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>`
      : `<span class="${className}">${escapeHtml(item.title)}</span>`;
  }

  function activePeriod() {
    if (state.period === "all") return { key: "all", label: "全部时期", shortLabel: "全部", kind: "all" };
    if (state.period === "undated") return { key: "undated", label: "日期待补", shortLabel: "待补", kind: "undated" };
    const periods = state.origin === "cn"
      ? chineseTimelinePeriods
      : Core.PERIODS.filter((period) => period.start <= currentYear);
    return periods.find((period) => period.key === state.period) || periods[0];
  }

  function renderAll(options = {}) {
    renderHeaderStats();
    renderTimeline(options.scrollTimeline);
    renderFilters();
    renderCatalog();
    renderDrawer();
    if (state.view === "swipe") renderSwipeDeck();
    if (state.view === "collection") renderCollection();
    if (state.view === "themes") renderThemes();
    if (state.view === "annual") renderAnnualView();
  }

  function renderHeaderStats() {
    const source = browseCatalog();
    const catalogStats = Core.collectionStats(source);
    const stats = Core.collectionStats([...selected.values()]);
    elements.catalogCount.textContent = source.length.toLocaleString("zh-CN");
    elements.japaneseCatalogCount.textContent = japaneseCatalog.length.toLocaleString("zh-CN");
    elements.chineseCatalogCount.textContent = chineseCatalog.length.toLocaleString("zh-CN");
    elements.selectedCount.textContent = stats.total.toLocaleString("zh-CN");
    elements.headerSelectedCount.textContent = stats.total.toLocaleString("zh-CN");
    elements.catalogTypeStats.innerHTML = state.origin === "cn"
      ? renderChinesePlatformStats(source)
      : renderStatTypeList(catalogStats.types);
    elements.selectedTypeStats.innerHTML = renderStatTypeList(stats.types);
  }

  function renderChinesePlatformStats(items) {
    const keys = [
      ["cn-tv", "TV动画"], ["cn-web", "WEB动画"], ["cn-movie", "动画电影"], ["cn-other", "其他"],
    ];
    return keys.map(([key, label], index) => {
      const count = items.filter((item) => chineseCategory(item)?.key === key).length;
      return `<span><i class="stat-type-dot stat-type-dot--${["tv", "theatrical", "movie", "other"][index]}" aria-hidden="true"></i><b>${escapeHtml(label)}</b><strong>${count.toLocaleString("zh-CN")}</strong></span>`;
    }).join("");
  }

  function renderStatTypeList(types) {
    return ["tv", "web", "movie", "theatrical", "other"].map((key) => `
      <span><i class="stat-type-dot stat-type-dot--${key}" aria-hidden="true"></i><b>${escapeHtml(TYPE_LABELS[key])}</b><strong>${Number(types[key] || 0).toLocaleString("zh-CN")}</strong></span>`).join("");
  }

  function renderTimeline(shouldScroll = false) {
    const collectionContext = state.view === "collection";
    const source = collectionContext ? [...selected.values()] : browseCatalog();
    const activePeriodKey = collectionContext ? state.collectionPeriod : state.period;
    const japanesePeriods = Core.PERIODS.filter((period) => period.start <= currentYear);
    const basePeriods = !collectionContext && state.origin === "cn" ? chineseTimelinePeriods : japanesePeriods;
    const matchesPeriod = !collectionContext && state.origin === "cn" ? matchesChinesePeriod : Core.matchesPeriod;
    const periodCounts = new Map(
      basePeriods.map((period) => [
        period.key,
        source.filter((item) => matchesPeriod(item, period.key)).length,
      ])
    );

    const periods = collectionContext
      ? [
          { key: "all", label: "全部个人记录", shortLabel: "全部" },
          ...japanesePeriods,
          ...(source.some((item) => !Number.isInteger(item.year)) ? [{ key: "undated", label: "日期待补", shortLabel: "待补" }] : []),
        ]
      : state.origin === "cn"
        ? [{ key: "all", label: "全部已发布国产动画", shortLabel: "全部" }, ...chineseTimelinePeriods, { key: "undated", label: "日期待补", shortLabel: "待补" }]
        : japanesePeriods;
    elements.timeline.classList.toggle("is-searching", !collectionContext && Boolean(Core.normalizeText(state.query)));
    elements.timelineTitle.textContent = collectionContext ? "选择个人记录年代" : "选择年代";
    elements.timelineYearInput.max = String(currentYear);
    elements.timeline.setAttribute("aria-label", collectionContext ? "个人记录年代和年份索引" : "年代和年份索引");
    elements.timeline.innerHTML = periods.map((period) => {
      const active = period.key === activePeriodKey;
      const isAll = period.key === "all";
      const count = isAll ? source.length : period.key === "undated"
        ? source.filter((item) => Core.matchesPeriod(item, "undated")).length
        : periodCounts.get(period.key) || 0;
      return `
        <button
          class="timeline-item${isAll ? " timeline-item--all" : ""}${active ? " is-active" : ""}${count ? " has-data" : ""}"
          type="button"
          role="listitem"
          data-period="${period.key}"
          aria-pressed="${active}"
          title="${escapeHtml(period.label)}${count ? ` · ${count}部${collectionContext ? "个人记录" : "资料"}` : " · 暂无记录"}"
        >
          <span>${escapeHtml(period.shortLabel)}</span>
          <i aria-hidden="true"></i>
          <small>${count || "·"}</small>
        </button>`;
    }).join("");

    if (shouldScroll) {
      requestAnimationFrame(() => {
        elements.timeline.querySelector(".is-active")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      });
    }
  }

  function renderFilters() {
    elements.originButtons.forEach((button) => {
      const active = button.dataset.origin === state.origin;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    elements.seasonFilters.innerHTML = Core.SEASONS.map((season) => `
      <button
        type="button"
        class="segment-button${state.season === season.key ? " is-active" : ""}"
        data-season="${season.key}"
        aria-pressed="${state.season === season.key}"
      >${season.label}</button>`).join("");

    const availableTypes = state.origin === "cn" ? CHINESE_TYPES : Core.TYPES;
    elements.typeFilters.innerHTML = availableTypes.map((type) => `
      <button
        type="button"
        class="segment-button${state.type === type.key ? " is-active" : ""}"
        data-type="${type.key}"
        aria-pressed="${state.type === type.key}"
      >${type.label}</button>`).join("");

    elements.typeFilterGroup.hidden = false;
    elements.tvSeasonRow.hidden = state.origin === "cn" || state.type !== "tv";
    elements.catalogModeButtons.forEach((button) => {
      const active = button.dataset.catalogMode === state.catalogMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.lowVoteToggle.checked = state.collapseLowVotes;
    elements.compilationToggle.checked = state.collapseCompilations;
    elements.searchInput.value = state.query;
    elements.sortSelect.value = state.sort;
    elements.sortDirection.value = state.sortDirection;
  }

  function renderCatalog(anchor = null) {
    const source = browseCatalog();
    const period = activePeriod();
    const searchActive = Boolean(Core.normalizeText(state.query));
    const catalogFilters = searchActive ? { ...state, period: "all" } : state;
    const normalizedFilters = state.origin === "cn" ? { ...catalogFilters, period: "all", type: "all", season: "all" } : catalogFilters;
    let matching = Core.filterAnime(source, normalizedFilters);
    if (state.origin === "cn" && !searchActive) {
      matching = matching.filter((item) => matchesChinesePeriod(item, state.period));
    }
    if (state.origin === "cn" && state.type !== "all") {
      matching = matching.filter((item) => chineseCategory(item)?.key === state.type);
    }
    matching = Core.sortAnime(matching, state.sort, state.sortDirection);
    const isLowVoteFolded = (item) => state.collapseLowVotes && item.voteCount < 10;
    const isCompilationFolded = (item) => state.collapseCompilations && item.isCompilation;
    const folded = matching.filter((item) => isLowVoteFolded(item) || isCompilationFolded(item));
    const visible = matching.filter((item) => !isLowVoteFolded(item) && !isCompilationFolded(item));
    const rendered = state.origin === "cn" ? visible.slice(0, state.catalogLimit) : visible;
    const lowVoteCount = state.collapseLowVotes ? matching.filter((item) => item.voteCount < 10).length : 0;
    const compilationCount = state.collapseCompilations ? matching.filter((item) => item.isCompilation).length : 0;
    const foldedReasons = [
      lowVoteCount ? `${lowVoteCount.toLocaleString("zh-CN")} 部低样本` : "",
      compilationCount ? `${compilationCount.toLocaleString("zh-CN")} 部总集篇` : "",
    ].filter(Boolean);
    const matchesActivePeriod = state.origin === "cn" ? matchesChinesePeriod : Core.matchesPeriod;
    const allInPeriod = source.filter((item) => matchesActivePeriod(item, period.key));
    const selectedInPeriod = [...selected.values()].filter((item) => item.origin === state.origin && matchesActivePeriod(item, period.key));

    elements.activePeriodLabel.textContent = searchActive ? (state.origin === "cn" ? "全部国产搜索" : "全年代搜索") : period.label;
    elements.activePeriodKind.textContent = searchActive
      ? "GLOBAL SEARCH"
      : period.kind === "year" ? "YEAR ARCHIVE" : "ERA ARCHIVE";
    elements.browseSummary.textContent = searchActive
      ? `正在全部 ${source.length.toLocaleString("zh-CN")} 部${state.origin === "cn" ? "国产候选" : "日番"}资料中搜索“${state.query.trim()}”，年代索引暂不限制结果。`
      : allInPeriod.length
        ? `${state.origin === "cn" ? "国产资料库" : "资料库"}收录 ${allInPeriod.length} 部，你已选择 ${selectedInPeriod.length} 部。${state.origin === "cn" ? " 当前按番组计划标签暂分为 TV、WEB、动画电影和其他。" : ""}`
        : "这个时间段的数据仍在整理中，你可以先手动添加。";
    if (state.view === "browse") {
      elements.timelineTitle.textContent = searchActive ? "正在搜索全部年代" : "选择年代";
      elements.timeline.classList.toggle("is-searching", searchActive);
    }
    elements.resultCount.textContent = visible.length.toLocaleString("zh-CN");
    elements.foldedCount.textContent = folded.length
      ? `（实际折叠 ${folded.length.toLocaleString("zh-CN")} 部：${foldedReasons.join("、")}）`
      : "";
    elements.posterGrid.hidden = state.catalogMode !== "poster" || visible.length === 0;
    elements.monthlyCatalog.hidden = state.catalogMode !== "monthly" || visible.length === 0;
    elements.catalogEmpty.hidden = visible.length !== 0;
    elements.catalogLoadMore.hidden = rendered.length >= visible.length || visible.length === 0;
    elements.catalogLoadMore.textContent = `继续加载（已显示 ${rendered.length.toLocaleString("zh-CN")} / ${visible.length.toLocaleString("zh-CN")}）`;
    if (!visible.length) {
      elements.catalogEmpty.querySelector("h3").textContent = folded.length ? "符合条件的作品已全部折叠" : "这里暂时还没有作品";
      elements.catalogEmpty.querySelector("p").textContent = folded.length
        ? "关闭上方相应的折叠选项即可查看这些作品。"
        : searchActive
          ? "没有找到匹配作品，可以缩短关键词或检查译名。"
          : "可以换一个年代或筛选条件，也可以先手动添加一部动画。";
    }

    elements.posterGrid.innerHTML = rendered.map(renderPosterCard).join("");
    elements.monthlyCatalog.innerHTML = renderMonthlyCatalog(rendered);
    elements.posterGrid.querySelectorAll("img").forEach((image) => {
      image.addEventListener("error", () => {
        image.hidden = true;
        image.closest(".poster-frame")?.classList.add("has-fallback");
      }, { once: true });
    });
    restoreBrowseAnchor(anchor);
  }

  function captureBrowseAnchor() {
    const container = state.catalogMode === "poster" ? elements.posterGrid : elements.monthlyCatalog;
    const candidates = [...container.querySelectorAll("[data-browse-id]")]
      .map((node) => ({ node, rect: node.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom > 90 && rect.top < window.innerHeight);
    const nearest = candidates.sort((a, b) => Math.abs(a.rect.top - 120) - Math.abs(b.rect.top - 120))[0];
    return nearest ? { id: nearest.node.dataset.browseId, top: nearest.rect.top } : null;
  }

  function restoreBrowseAnchor(anchor) {
    if (!anchor) return;
    document.documentElement.style.overflowAnchor = "none";
    document.documentElement.style.scrollBehavior = "auto";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const container = state.catalogMode === "poster" ? elements.posterGrid : elements.monthlyCatalog;
      const target = [...container.querySelectorAll("[data-browse-id]")]
        .find((node) => node.dataset.browseId === anchor.id);
      if (!target) {
        document.documentElement.style.overflowAnchor = "";
        document.documentElement.style.scrollBehavior = "";
        return;
      }
      const align = () => window.scrollTo({
        top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - anchor.top),
        left: 0,
        behavior: "auto",
      });
      align();
      setTimeout(() => {
        align();
        document.documentElement.style.overflowAnchor = "";
        document.documentElement.style.scrollBehavior = "";
      }, 80);
    }));
  }

  function updateFloatingCatalogMode() {
    const filterPanel = elements.catalogModeGroup.closest(".filter-panel");
    const browseRect = elements.browseView.getBoundingClientRect();
    const shouldFloat = state.view === "browse"
      && filterPanel.getBoundingClientRect().bottom < 76
      && browseRect.bottom > 180;
    elements.catalogModeGroup.classList.toggle("is-floating", shouldFloat);
  }

  function releaseMonth(item) {
    const match = String(item.releaseDate || "").match(/^\d{4}-(\d{1,2})/);
    if (match) return Math.min(12, Math.max(1, Number(match[1])));
    if (item.type === "tv" && item.season) return Number(item.season);
    return 0;
  }

  function catalogTypeLabel(item) {
    return item.origin === "cn" ? chineseCategory(item)?.label || "其他 / 待分类" : TYPE_LABELS[item.type] || "动画";
  }

  function catalogDateLabel(item) {
    return item.releaseDate || (item.year ? `${item.year}年` : "日期待补");
  }

  function renderBangumiTags(item, compact = false) {
    const publicTags = (item.bangumiTags || []).filter((tag) => !CATALOG_TAG_DISPLAY_EXCLUSIONS.has(Core.normalizeText(tag.name)));
    const publicNames = new Set((item.bangumiTags || []).map((tag) => Core.normalizeText(tag.name)));
    const ordinaryTag = item.bangumiOrdinaryTag || (item.bangumiAllTags || []).find((tag) => (
      !tag.public
      && !publicNames.has(Core.normalizeText(tag.name))
      && !CATALOG_TAG_DISPLAY_EXCLUSIONS.has(Core.normalizeText(tag.name))
    ));
    const tags = [
      ...publicTags.map((tag) => ({ ...tag, ordinary: false })),
      ...(ordinaryTag && !publicTags.some((tag) => Core.normalizeText(tag.name) === Core.normalizeText(ordinaryTag.name))
        ? [{ ...ordinaryTag, ordinary: true }]
        : []),
    ];
    if (!tags.length) return "";
    return `
      <div class="anime-tags${compact ? " is-compact" : ""}" aria-label="番组计划用户标签">
        ${tags.map((tag) => `
          <span class="${tag.ordinary ? "is-ordinary" : ""}" title="${tag.count === null ? "番组计划归档未提供人数" : `${tag.count.toLocaleString("zh-CN")} 人标注`}${tag.ordinary ? " · 普通标签" : ""}">${escapeHtml(tag.name)}</span>`).join("")}
      </div>`;
  }

  function renderMonthlyCatalog(items) {
    if (!items.length) return "";
    const groups = new Map(Array.from({ length: 12 }, (_, index) => [index + 1, []]));
    groups.set(0, []);
    items.forEach((item) => groups.get(releaseMonth(item)).push(item));
    return [...groups.entries()]
      .filter(([, monthItems]) => monthItems.length)
      .sort(([monthA], [monthB]) => (monthA || 13) - (monthB || 13))
      .map(([month, monthItems]) => `
        <section class="month-section" data-browse-month="${month || "unknown"}">
          <div class="month-heading">
            <h3>${month ? `${month}月` : "日期待补"}</h3>
            <span>${monthItems.length} 部</span>
          </div>
          <div class="monthly-table-wrap">
            <table class="monthly-table">
              <thead><tr><th>作品</th><th>类型</th><th>首播 / 上映</th><th>评分</th><th>评分人数</th></tr></thead>
              <tbody>${monthItems.map((item) => `
                <tr data-browse-id="${escapeHtml(item.id)}" data-theme-context-id="${escapeHtml(item.id)}" tabindex="0" class="reaction-${escapeHtml(selected.get(item.id)?.reaction || "none")}">
                  <td><strong>${titleLink(item, "anime-title-link monthly-title-link")}</strong><small>${escapeHtml(item.originalTitle || "")}</small>${renderBangumiTags(item, true)}</td>
                  <td><span class="type-badge type-badge--${item.origin === "cn" ? chineseCategory(item).key : escapeHtml(item.type)}">${escapeHtml(catalogTypeLabel(item))}</span>${item.origin === "cn" ? `<small class="raw-platform-label">原始平台：${escapeHtml(item.preliminaryTypeLabel || "未标注")}</small>` : ""}</td>
                  <td>${escapeHtml(catalogDateLabel(item))}</td>
                  <td>${item.score !== null ? item.score.toFixed(1) : "—"}</td>
                  <td>${item.voteCount.toLocaleString("zh-CN")}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        </section>`).join("");
  }

  function renderPosterCard(item) {
    const isSelected = selected.has(item.id);
    const poster = safeUrl(item.poster);
    const typeLabel = catalogTypeLabel(item);
    const dateLabel = catalogDateLabel(item);
    const mediaMeta = [];
    if (item.origin === "cn") {
      mediaMeta.push(`原始平台 ${item.preliminaryTypeLabel || "未标注"}`);
    } else if (item.type !== "tv") {
      mediaMeta.push(item.runtimeText ? `时长 ${item.runtimeText}` : "时长待补");
    }
    mediaMeta.push(item.voteCount ? `${item.voteCount.toLocaleString("zh-CN")} 人评分` : "暂无评分");
    return `
      <article class="poster-card${isSelected ? " is-selected" : ""}${item.origin === "cn" ? " poster-card--cn" : ""}" data-browse-id="${escapeHtml(item.id)}" data-theme-context-id="${escapeHtml(item.id)}" data-browse-month="${releaseMonth(item) || "unknown"}" tabindex="0">
        <span class="poster-frame${poster ? "" : " has-fallback"}">
          ${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(item.title)}海报" loading="lazy" referrerpolicy="no-referrer" />` : ""}
          <span class="poster-fallback" aria-hidden="true">${escapeHtml(item.title.slice(0, 1) || "番")}</span>
          ${item.score !== null ? `<span class="score-badge" title="${item.voteCount.toLocaleString("zh-CN")} 人评分"><span>★ ${item.score.toFixed(1)}</span></span>` : ""}
        </span>
        <div class="poster-info">
          <div class="card-type-row">
            <span class="type-badge type-badge--${item.origin === "cn" ? chineseCategory(item).key : escapeHtml(item.type)}">${escapeHtml(typeLabel)}</span>
          </div>
          <div class="card-meta-row">
            <span>${escapeHtml(dateLabel)}</span>
            ${mediaMeta.map((value) => `<span>${escapeHtml(value)}</span>`).join("")}
          </div>
          <h3>${titleLink(item)}</h3>
          <p>${escapeHtml(item.originalTitle || "暂无原名资料")}</p>
          ${renderBangumiTags(item)}
        </div>
      </article>`;
  }

  function toggleThemeRecord(list, id, bucketYear = state.themeYear, { compactToast = false } = {}) {
    const existing = themeRecord(list, id, bucketYear);
    const item = catalogById.get(id);
    if (!item) return;
    if (existing) {
      list.records.splice(list.records.indexOf(existing), 1);
      showToast(compactToast ? "已移出喜好图鉴" : `已从「${list.title}」移出《${item.title}》`, "success", compactToast ? 1500 : 2600);
    } else {
      const visibleCount = list.annual
        ? list.records.filter((record) => record.bucketYear === bucketYear).length
        : list.records.length;
      const replacingSingle = !list.annual && list.maxItems === 1 && visibleCount >= 1;
      if (list.maxItems && visibleCount >= list.maxItems && !replacingSingle) return showToast(`${list.title}最多收录${list.maxItems}部`, "error");
      if (replacingSingle) list.records.splice(0, list.records.length);
      list.records.push({ id, note: "", bucketYear: list.annual ? bucketYear : null, addedAt: new Date().toISOString() });
      let synced = false;
      if (list.syncCareer && !selected.has(id)) {
        selected.set(id, { ...item, reaction: "watched", addedAt: new Date().toISOString() });
        saveCollection();
        synced = true;
      }
      showToast(compactToast
        ? (replacingSingle ? "已更换喜好主题" : "已加入喜好图鉴")
        : `${replacingSingle ? "已更换" : "已加入"}「${list.title}」${synced ? "并同步生涯表" : ""}：《${item.title}》`, "success", compactToast ? 1500 : 2600);
    }
    saveThemeLists();
    renderAll();
  }

  let quickMenuItemId = null;

  function closeThemeQuickMenu() {
    quickMenuItemId = null;
    elements.themeQuickMenu.hidden = true;
  }

  function openThemeQuickMenu(id, clientX, clientY) {
    const item = catalogById.get(id) || selected.get(id);
    if (!item) return;
    const currentReaction = selected.get(id)?.reaction || null;
    const reactionOptions = [
      { key: "watched", icon: "✓", label: "看过" },
      { key: "recommended", icon: "★", label: "推荐" },
      { key: "difficult", icon: "×", label: "不推荐" },
    ];
    quickMenuItemId = id;
    elements.themeQuickMenuTitle.textContent = item.title;
    elements.themeQuickMenuItems.innerHTML = `
      <section class="theme-quick-group theme-quick-group--reaction" aria-label="生涯标记">
        <span>生涯标记</span>
        ${reactionOptions.map((option) => `
          <button type="button" role="menuitemradio" data-quick-reaction="${option.key}" aria-checked="${currentReaction === option.key}">
            <i>${option.icon}</i><b>${option.label}</b><small>${currentReaction === option.key ? "当前" : option.key === "watched" && !currentReaction ? "加入生涯表" : "标记"}</small>
          </button>`).join("")}
      </section>
      <section class="theme-quick-group theme-quick-group--flat">
        <span>喜好图鉴</span>
        ${themeLists.map((list) => {
          const bucketYear = list.annual ? item.year : state.themeYear;
          const disabled = list.annual && !Number.isInteger(item.year);
          const active = !disabled && Boolean(themeRecord(list, id, bucketYear));
          return `<button type="button" role="menuitemcheckbox" data-quick-theme="${escapeHtml(list.id)}" aria-checked="${active}" ${disabled ? "disabled" : ""}>
            <i>${list.icon}</i><b>${escapeHtml(list.title)}</b><small>${disabled ? "需要作品年份" : list.annual ? `${item.year}年度` : active ? "✓ 已加入" : "加入"}</small>
          </button>`;
        }).join("")}
      </section>`;
    elements.themeQuickMenu.hidden = false;
    elements.themeQuickMenu.style.left = `${Math.max(8, clientX)}px`;
    elements.themeQuickMenu.style.top = `${Math.max(8, clientY)}px`;
    requestAnimationFrame(() => {
      const rect = elements.themeQuickMenu.getBoundingClientRect();
      elements.themeQuickMenu.style.left = `${Math.max(8, Math.min(clientX, window.innerWidth - rect.width - 8))}px`;
      elements.themeQuickMenu.style.top = `${Math.max(8, Math.min(clientY, window.innerHeight - rect.height - 8))}px`;
      elements.themeQuickMenu.querySelector("button:not(:disabled)")?.focus();
    });
  }

  function setCollectionReaction(id, reaction) {
    const item = selected.get(id) || catalogById.get(id);
    if (!item || !["watched", "recommended", "difficult"].includes(reaction)) return;
    const wasSelected = selected.has(id);
    selected.set(id, {
      ...item,
      reaction,
      addedAt: item.addedAt || new Date().toISOString(),
    });
    swipeSkipped.delete(id);
    saveCollection();
    saveSwipeSkipped();
    renderHeaderStats();
    renderDrawer();
    if (state.view === "collection") renderCollection();
    if (state.view === "browse") renderCatalog();
    showToast(reaction === "recommended" ? "已标记为推荐" : reaction === "difficult" ? "已标记为不推荐" : wasSelected ? "已改为普通看过" : "已加入生涯表", "success", 1500);
  }

  function renderDrawer() {
    const recent = [...selected.values()]
      .sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")))
      .slice(0, 12);

    if (!recent.length) {
      elements.drawerList.innerHTML = `
        <div class="drawer-empty">
          <span aria-hidden="true">＋</span>
          <h3>还没有收录作品</h3>
          <p>可以先用“刷刷刷”快速整理，或在动画库中右键 / 长按作品标记为看过。</p>
        </div>`;
      return;
    }

    elements.drawerList.innerHTML = recent.map((item) => `
      <article class="drawer-item">
        <span class="drawer-thumb${item.poster ? "" : " no-image"}">
          ${item.poster ? `<img src="${escapeHtml(safeUrl(item.poster))}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : escapeHtml(item.title.slice(0, 1))}
        </span>
        <div>
          <strong class="reaction-title reaction-title--${escapeHtml(item.reaction)}">${titleLink(item, "anime-title-link drawer-title-link")}${item.reaction === "difficult" ? " 😵‍💫" : ""}</strong>
          <small>${escapeHtml(item.year ? `${item.year}年` : "日期待补")} · ${escapeHtml(catalogTypeLabel(item))}</small>
        </div>
        <button type="button" data-remove-id="${escapeHtml(item.id)}" aria-label="移除${escapeHtml(item.title)}">×</button>
      </article>`).join("");
  }

  function openDrawer() {
    elements.selectionDrawer.classList.add("is-open");
    elements.selectionDrawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    elements.selectionDrawer.querySelector(".drawer-panel .icon-button")?.focus();
  }

  function closeDrawer() {
    elements.selectionDrawer.classList.remove("is-open");
    elements.selectionDrawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");
  }

  function setMobileNavOpen(open) {
    const isOpen = Boolean(open);
    document.body.classList.toggle("mobile-nav-open", isOpen);
    elements.openSelection?.setAttribute("aria-expanded", String(isOpen));
  }

  function toggleMobileNav() {
    setMobileNavOpen(!document.body.classList.contains("mobile-nav-open"));
  }

  function selectTheme(id, scroll = false) {
    if (!themeLists.some((list) => !list.annual && list.id === id)) return;
    state.activeThemeId = id;
    state.themeQuery = "";
    elements.themeSearchInput.value = "";
    saveThemeLists();
    renderThemes();
    if (scroll) elements.themeWorkbench.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteThemeList(id) {
    const list = themeLists.find((candidate) => !candidate.annual && candidate.id === id);
    if (!list) return;
    if (mainThemeLists().length <= 1) {
      showToast("至少保留一个主题", "error");
      return;
    }
    if (!window.confirm(`删除主题“${list.title}”？该主题中的作品也会被移除。`)) return;
    const index = themeLists.indexOf(list);
    themeLists.splice(index, 1);
    deletedThemeIds.add(list.id);
    if (state.activeThemeId === list.id) state.activeThemeId = mainThemeLists()[0]?.id || "";
    saveThemeLists();
    renderThemes();
    showToast("主题已删除");
  }

  function addCustomTheme(event) {
    event.preventDefault();
    if (!elements.customThemeForm.reportValidity()) return;
    const data = new FormData(elements.customThemeForm);
    const title = String(data.get("title") || "").trim().slice(0, 24);
    if (!title) return;
    const icon = String(data.get("icon") || "✨").trim().slice(0, 4) || "✨";
    const description = String(data.get("description") || "").trim().slice(0, 80);
    const list = {
      id: `custom-${Date.now().toString(36)}`,
      group: "自定义",
      title,
      icon,
      kicker: "YOUR QUESTION",
      description,
      layout: "custom",
      syncCareer: false,
      custom: true,
      maxItems: 1,
      records: [],
    };
    themeLists.push(list);
    state.activeThemeId = list.id;
    state.themeQuery = "";
    elements.themeSearchInput.value = "";
    saveThemeLists();
    elements.customThemeForm.reset();
    elements.customThemeDialog.close();
    renderThemes();
    elements.themeWorkbench.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`已添加主题「${title}」`);
  }

  function themeItems(list = activeThemeList()) {
    return visibleThemeRecords(list)
      .map((record) => ({ record, item: catalogById.get(record.id) }))
      .filter(({ item }) => item);
  }

  function renderThemeMatrix(activeList = activeThemeList()) {
    const listsForMatrix = mainThemeLists();
    elements.themeMatrix.innerHTML = `<div class="theme-flat-grid">${listsForMatrix.map((list, listIndex) => {
      const item = list.records.map((record) => catalogById.get(record.id)).find(Boolean);
      const poster = safeUrl(item?.poster);
      return `<article
        role="tab"
        class="theme-matrix-card theme-single-card${list.id === activeList.id ? " is-active" : ""}${list.custom ? " is-custom" : ""}"
        data-theme-id="${escapeHtml(list.id)}"
        aria-selected="${list.id === activeList.id}"
        tabindex="0"
        style="--theme-index:${listIndex}"
      >
        <span class="theme-matrix-card-top"><i>${escapeHtml(list.icon)}</i><b>${escapeHtml(list.title)}</b><button class="theme-delete-button" type="button" data-theme-delete="${escapeHtml(list.id)}" aria-label="删除主题${escapeHtml(list.title)}">×</button></span>
        <span class="theme-single-poster${poster ? "" : " is-empty"}">
          ${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(item.title)}海报" loading="lazy" referrerpolicy="no-referrer" />` : `<i>＋</i>`}
        </span>
        ${item ? `<strong class="theme-single-title">${escapeHtml(item.title)}</strong>` : ""}
        ${list.custom && list.description ? `<small>${escapeHtml(list.description)}</small>` : ""}
      </article>`;
    }).join("")}</div>`;
    elements.themeMatrix.querySelectorAll("img").forEach((image) => image.addEventListener("error", () => {
      image.closest(".theme-single-poster")?.classList.add("is-empty");
    }, { once: true }));
  }

  function renderThemes() {
    const list = activeThemeList();
    const entries = themeItems(list).slice(0, 1);
    renderThemeMatrix(list);
    elements.themeWorkbench.className = `theme-workbench theme-layout--${list.layout}`;
    elements.themeIcon.textContent = list.icon;
    elements.themeKicker.textContent = list.kicker;
    elements.themeTitle.textContent = list.title;
    elements.themeDescription.textContent = list.custom ? list.description : "";
    elements.themeCareerSync.checked = list.syncCareer;
    elements.themeSearchHelp.textContent = "搜索结果按评分人数排列，点击右侧按钮即可加入或移出。";
    elements.themeItemCount.textContent = entries.length.toLocaleString("zh-CN");
    elements.themeEmptyHint.hidden = entries.length > 0;
    renderThemeSearchResults(list);
    renderThemeGallery(list, entries);
  }

  function moveThemeList(draggedId, targetId) {
    if (!draggedId || !targetId || draggedId === targetId) return false;
    const fromIndex = themeLists.findIndex((list) => !list.annual && list.id === draggedId);
    const toIndex = themeLists.findIndex((list) => !list.annual && list.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return false;
    [themeLists[fromIndex], themeLists[toIndex]] = [themeLists[toIndex], themeLists[fromIndex]];
    saveThemeLists();
    renderThemes();
    showToast("主题顺序已保存");
    return true;
  }

  function moveAnnualRecord(draggedId, targetId) {
    if (!draggedId || !targetId || draggedId === targetId) return false;
    const list = annualThemeList();
    const yearIndexes = list.records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => record.bucketYear === state.themeYear);
    const ordered = yearIndexes.map(({ record }) => record);
    const fromIndex = ordered.findIndex((record) => record.id === draggedId);
    const toIndex = ordered.findIndex((record) => record.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return false;
    [ordered[fromIndex], ordered[toIndex]] = [ordered[toIndex], ordered[fromIndex]];
    yearIndexes.forEach(({ index }, orderIndex) => { list.records[index] = ordered[orderIndex]; });
    saveThemeLists();
    renderAnnualView();
    showToast(toIndex === 0 ? "已设为本年度最佳" : "年度十佳顺序已保存");
    return true;
  }

  function clearAnnualDragStyles() {
    elements.annualSelectedGrid.querySelectorAll(".is-dragging, .is-drop-target").forEach((card) => {
      card.classList.remove("is-dragging", "is-drop-target");
    });
    document.querySelector(".annual-drag-ghost")?.remove();
    document.body.classList.remove("annual-drag-active");
    annualDraggedId = null;
    if (annualTouchDrag?.timer) window.clearTimeout(annualTouchDrag.timer);
    annualTouchDrag = null;
  }

  function annualCardMarkup(item, index) {
    const poster = safeUrl(item.poster);
    const best = index === 0;
    return `<article class="annual-selected-card${best ? " is-best" : ""}" data-annual-record-id="${escapeHtml(item.id)}" tabindex="0" aria-label="${best ? "年度最佳" : `年度十佳第${index + 1}位`}：${escapeHtml(item.title)}；可拖动排序">
      ${best ? `<span class="annual-best-decoration" aria-hidden="true"><i>✦</i><b>♛</b><i>✦</i></span>` : ""}
      <span class="annual-poster${poster ? "" : " has-fallback"}">${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(item.title)}海报" loading="lazy" referrerpolicy="no-referrer" />` : ""}<b>${escapeHtml(item.title.slice(0, 1) || "番")}</b></span>
      <button class="annual-selected-remove" type="button" data-annual-toggle="${escapeHtml(item.id)}" aria-label="从${state.themeYear}年度十佳移除${escapeHtml(item.title)}"><span aria-hidden="true">×</span></button>
    </article>`;
  }

  function renderAnnualView() {
    const list = annualThemeList();
    if (!list) return;
    const years = Array.from({ length: currentYear - 1917 + 1 }, (_, index) => 1917 + index).reverse();
    elements.annualPageYear.innerHTML = years.map((year) => `<option value="${year}">${year}年</option>`).join("");
    elements.annualPageYear.value = String(state.themeYear);
    elements.annualSortSelect.value = state.annualSort;
    elements.annualSortDirection.value = state.annualSortDirection;
    elements.annualSelectedYear.textContent = String(state.themeYear);
    elements.annualCareerSync.checked = list.syncCareer;

    const selectedEntries = list.records
      .filter((record) => record.bucketYear === state.themeYear)
      .map((record) => ({ record, item: catalogById.get(record.id) }))
      .filter(({ item }) => item);
    elements.annualSelectedCount.textContent = String(selectedEntries.length);
    elements.annualSelectedGrid.innerHTML = selectedEntries.length
      ? selectedEntries.map(({ item }, index) => annualCardMarkup(item, index)).join("")
      : `<div class="annual-empty"><span>10</span><div><strong>${state.themeYear}年度还没有入选作品</strong><p>从下方当年作品中挑选你的个人十佳。</p></div></div>`;

    elements.annualOriginFilters.querySelectorAll("[data-annual-origin]").forEach((button) => {
      const active = button.dataset.annualOrigin === state.annualOrigin;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const availableTypes = state.annualOrigin === "cn" ? CHINESE_TYPES : Core.TYPES;
    if (!availableTypes.some((type) => type.key === state.annualType)) state.annualType = "all";
    elements.annualTypeFilters.innerHTML = availableTypes.map((type) => `
      <button type="button" class="segment-button${state.annualType === type.key ? " is-active" : ""}" data-annual-type="${type.key}" aria-pressed="${state.annualType === type.key}">${type.label}</button>`).join("");
    elements.annualSeasonRow.hidden = state.annualOrigin !== "jp" || state.annualType !== "tv";
    elements.annualSeasonFilters.innerHTML = Core.SEASONS.map((season) => `
      <button type="button" class="segment-button${state.annualSeason === season.key ? " is-active" : ""}" data-annual-season="${season.key}" aria-pressed="${state.annualSeason === season.key}">${season.label}</button>`).join("");

    const query = Core.normalizeText(state.annualQuery);
    const annualSource = state.annualOrigin === "cn" ? chineseCatalog : japaneseCatalog;
    let yearItems = annualSource.filter((item) => item.year === state.themeYear);
    if (state.annualType !== "all") {
      yearItems = yearItems.filter((item) => state.annualOrigin === "cn"
        ? chineseCategory(item)?.key === state.annualType
        : item.type === state.annualType);
    }
    if (state.annualOrigin === "jp" && state.annualType === "tv" && state.annualSeason !== "all") {
      yearItems = yearItems.filter((item) => String(item.season) === state.annualSeason);
    }
    if (query) yearItems = yearItems.filter((item) => [item.title, item.originalTitle, ...item.aliases, item.studio].some((value) => Core.normalizeText(value).includes(query)));
    yearItems = Core.sortAnime(yearItems, state.annualSort, state.annualSortDirection);
    const annualTotal = yearItems.length;
    const originLabel = state.annualOrigin === "cn" ? "国产" : "日番";
    const typeLabel = availableTypes.find((type) => type.key === state.annualType)?.label || "全部类型";
    const seasonLabel = state.annualOrigin === "jp" && state.annualType === "tv" && state.annualSeason !== "all"
      ? ` · ${SEASON_LABELS[state.annualSeason]}` : "";
    elements.annualCatalogTitle.textContent = `${state.themeYear}年${originLabel} · ${typeLabel}${seasonLabel}`;
    elements.annualCatalogCount.textContent = annualTotal.toLocaleString("zh-CN");
    yearItems = yearItems.slice(0, state.annualLimit);
    const full = selectedEntries.length >= (list.maxItems || 10);
    elements.annualCatalogGrid.innerHTML = yearItems.length
      ? yearItems.map((item) => {
          const poster = safeUrl(item.poster);
          const active = Boolean(themeRecord(list, item.id, state.themeYear));
          const disabled = full && !active;
          const score = Number.isFinite(item.score) && item.voteCount >= 30 ? `★ ${item.score.toFixed(1)}` : "评分样本较少";
          return `<article class="annual-catalog-card${active ? " is-selected" : ""}" data-annual-year="${item.year}" data-annual-catalog-origin="${item.origin}">
            <span class="annual-catalog-poster${poster ? "" : " has-fallback"}">${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(item.title)}海报" loading="lazy" referrerpolicy="no-referrer" />` : ""}<b>${escapeHtml(item.title.slice(0, 1) || "番")}</b></span>
            <div><h4>${titleLink(item, "anime-title-link annual-title-link")}</h4><p>${escapeHtml(catalogTypeLabel(item))} · ${escapeHtml(score)}</p><small>${item.voteCount.toLocaleString("zh-CN")} 人评分</small>${renderBangumiTags(item, true)}</div>
            <button type="button" data-annual-toggle="${escapeHtml(item.id)}" class="${active ? "is-active" : ""}" ${disabled ? "disabled" : ""}>${active ? "✓ 已入选" : disabled ? "已满十部" : "＋ 入选"}</button>
          </article>`;
        }).join("")
      : `<div class="annual-empty"><span>空</span><div><strong>没有找到该年度的作品</strong><p>${query ? "换个关键词试试。" : "当前资料库尚未收录这一年的动画。"}</p></div></div>`;
    elements.annualLoadMore.hidden = state.annualLimit >= annualTotal;
    elements.annualLoadMore.textContent = `继续加载（还剩 ${Math.max(0, annualTotal - state.annualLimit).toLocaleString("zh-CN")} 部）`;
    elements.annualView.querySelectorAll("img").forEach((image) => image.addEventListener("error", () => image.parentElement?.classList.add("has-fallback"), { once: true }));
  }

  function renderThemeSearchResults(list = activeThemeList()) {
    const query = Core.normalizeText(state.themeQuery);
    if (!query) {
      elements.themeSearchResults.innerHTML = "";
      return;
    }
    let matches = Core.filterAnime(catalog, { period: "all", season: "all", type: "all", query: state.themeQuery });
    if (list.annual) matches = matches.filter((item) => item.year === state.themeYear);
    matches = Core.sortAnime(matches, "votes", "desc").slice(0, 12);
    elements.themeSearchResults.innerHTML = matches.length ? matches.map((item) => {
      const poster = safeUrl(item.poster);
      const active = Boolean(themeRecord(list, item.id));
      const replacing = !active && !list.annual && list.maxItems === 1 && list.records.length > 0;
      return `<article class="theme-search-result"><span class="theme-search-thumb${poster ? "" : " has-fallback"}">${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : escapeHtml(item.title.slice(0, 1))}</span><div><strong>${titleLink(item, "anime-title-link theme-result-title")}</strong><small>${escapeHtml(item.year ? `${item.year}年` : "日期待补")} · ${escapeHtml(catalogTypeLabel(item))} · ${item.voteCount.toLocaleString("zh-CN")}人评分</small></div><button type="button" data-theme-toggle="${escapeHtml(item.id)}" class="${active ? "is-active" : ""}">${active ? "✓ 已加入" : replacing ? "↻ 替换" : "＋ 加入"}</button></article>`;
    }).join("") : `<p class="theme-search-empty">没有找到符合条件的作品。</p>`;
  }

  function notePlaceholder(list) {
    if (list.id === "comfort") return "它为什么让你觉得舒服？例如：配乐、氛围、角色陪伴感";
    if (list.id === "worst") return "选填一句避雷理由";
    if (list.id === "bittersweet") return "选填一句你放不下的理由";
    if (list.id === "recommend") return "选填一句安利语";
    if (list.id === "first_cp") return "写下 CP 名或第一次磕到的瞬间";
    return "选填一句私人备注";
  }

  function renderThemeGallery(list, entries) {
    elements.themeGallery.className = `theme-gallery theme-gallery--${list.layout}`;
    elements.themeGallery.innerHTML = entries.map(({ item, record }, index) => {
      const poster = safeUrl(item.poster);
      return `<article class="theme-card" style="--card-index:${index}"><span class="theme-rank">${list.annual ? String(index + 1).padStart(2, "0") : list.icon}</span><div class="theme-card-poster${poster ? "" : " has-fallback"}">${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(item.title)}海报" loading="lazy" referrerpolicy="no-referrer" />` : `<b>${escapeHtml(item.title.slice(0, 1))}</b>`}</div><div class="theme-card-copy"><small>${escapeHtml(item.year ? `${item.year}年` : "日期待补")} · ${escapeHtml(catalogTypeLabel(item))}</small><h4>${titleLink(item, "anime-title-link theme-card-title")}</h4><label><span>${list.id === "comfort" ? "舒服的理由" : list.id === "first_cp" ? "CP / 瞬间" : "一句话"}</span><input data-theme-note="${escapeHtml(item.id)}" value="${escapeHtml(record.note)}" maxlength="120" placeholder="${escapeHtml(notePlaceholder(list))}" /></label></div><button class="theme-remove" type="button" data-theme-remove="${escapeHtml(item.id)}" aria-label="从${escapeHtml(list.title)}移除${escapeHtml(item.title)}">×</button></article>`;
    }).join("");
    elements.themeGallery.querySelectorAll("img").forEach((image) => image.addEventListener("error", () => image.closest(".theme-card-poster")?.classList.add("has-fallback"), { once: true }));
  }

  function mainThemeLists() {
    return themeLists.filter((list) => !list.annual);
  }

  function answeredThemeCount() {
    return mainThemeLists().filter((list) => list.records.length > 0).length;
  }

  function openShareStudio() {
    elements.shareDialog.classList.remove("is-annual-only");
    elements.shareDialog.querySelector(".share-dialog-header .eyebrow").textContent = "SHARE YOUR ANIME PROFILE";
    elements.shareDialog.querySelector("#shareDialogTitle").textContent = "把喜好图鉴做成可分享的图片";
    elements.shareDialog.querySelector(".share-dialog-header p:last-child").textContent = "导出的是独立排版，不会把网页按钮或空白区域截进图片。";
    if (!elements.shareDialog.open) elements.shareDialog.showModal();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function fillRoundedRect(ctx, x, y, width, height, radius, fill) {
    ctx.save();
    roundedRect(ctx, x, y, width, height, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  function fitCanvasText(ctx, text, maxWidth) {
    const value = String(text || "");
    if (ctx.measureText(value).width <= maxWidth) return value;
    let output = value;
    while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1);
    return `${output}…`;
  }

  function wrapCanvasText(ctx, text, maxWidth, maxLines = 2) {
    const chars = [...String(text || "")];
    const lines = [];
    let line = "";
    chars.forEach((char) => {
      const candidate = line + char;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = char;
      } else line = candidate;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const clipped = lines.slice(0, maxLines);
      clipped[maxLines - 1] = fitCanvasText(ctx, `${clipped[maxLines - 1]}…`, maxWidth);
      return clipped;
    }
    return lines;
  }

  async function loadShareImage(url) {
    const clean = safeUrl(url);
    if (!clean) return null;
    if (shareImageCache.has(clean)) return shareImageCache.get(clean);
    const pending = (async () => {
      let sourceHost = "";
      try { sourceHost = new URL(clean, location.href).hostname; } catch { return null; }
      const resizedProxy = `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=420&h=630&fit=cover&output=webp&q=82`;
      const candidates = /(^|\.)bgm\.tv$/i.test(sourceHost)
        ? [resizedProxy]
        : [clean, resizedProxy];
      for (const candidate of candidates) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 9000);
        try {
          const response = await fetch(candidate, {
            mode: "cors",
            cache: "force-cache",
            credentials: "omit",
            referrerPolicy: "no-referrer",
            signal: controller.signal,
          });
          if (!response.ok) continue;
          const objectUrl = URL.createObjectURL(await response.blob());
          const image = new Image();
          image.decoding = "async";
          const loaded = new Promise((resolve) => {
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
          });
          image.src = objectUrl;
          const result = await loaded;
          URL.revokeObjectURL(objectUrl);
          if (result) return result;
        } catch {
          // 番组计划图片端点不允许 Canvas 跨域读取时，继续尝试只读图片代理。
        } finally {
          window.clearTimeout(timeout);
        }
      }
      return null;
    })();
    shareImageCache.set(clean, pending);
    pending.then((result) => {
      if (!result && shareImageCache.get(clean) === pending) shareImageCache.delete(clean);
    });
    return pending;
  }

  function drawPoster(ctx, item, image, x, y, width, height, radius = 18) {
    ctx.save();
    roundedRect(ctx, x, y, width, height, radius);
    ctx.clip();
    if (image?.naturalWidth) {
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const targetRatio = width / height;
      let sx = 0; let sy = 0; let sw = image.naturalWidth; let sh = image.naturalHeight;
      if (sourceRatio > targetRatio) {
        sw = image.naturalHeight * targetRatio;
        sx = (image.naturalWidth - sw) / 2;
      } else {
        sh = image.naturalWidth / targetRatio;
        sy = (image.naturalHeight - sh) / 2;
      }
      ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
    } else {
      const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
      gradient.addColorStop(0, "#f05245");
      gradient.addColorStop(1, "#267d75");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(width * .42)}px Georgia, serif`;
      ctx.fillText(String(item?.title || "番").slice(0, 1), x + width / 2, y + height / 2);
    }
    ctx.restore();
  }

  function shareGroupPalette(group) {
    return {
      "起点与影响": ["#ffe4d0", "#f05245"],
      "私人偏爱": ["#fff0ad", "#b78310"],
      "情绪共振": ["#dff1f6", "#307c98"],
      "审美高光": ["#eadfff", "#7753b2"],
      "特别企划": ["#d9f1e7", "#267d75"],
    }[group] || ["#f4f0e7", "#37343e"];
  }

  function shareEntriesForList(list) {
    return (list.annual ? visibleThemeRecords(list) : list.records)
      .map((record) => ({ record, item: catalogById.get(record.id) }))
      .filter(({ item }) => item);
  }

  async function prepareShareImages(lists) {
    const urls = new Set();
    lists.forEach((list) => shareEntriesForList(list).slice(0, list.annual ? 10 : 3).forEach(({ item }) => {
      const url = safeUrl(item.poster);
      if (url) urls.add(url);
    }));
    const queue = [...urls];
    let cursor = 0;
    const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (cursor < queue.length) {
        const url = queue[cursor];
        cursor += 1;
        await loadShareImage(url);
      }
    });
    await Promise.all(workers);
  }

  function shareDestinationUrl() {
    if (!/^https?:$/.test(location.protocol) || ["localhost", "127.0.0.1", "::1"].includes(location.hostname)) return "";
    return new URL(".", location.href).href;
  }

  async function loadShareQr() {
    const destination = shareDestinationUrl();
    if (!destination) return null;
    return loadShareImage(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(destination)}`);
  }

  function drawShareBackground(ctx, width, height, pageNumber, pageTotal, heading = {}) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#151419");
    gradient.addColorStop(.62, "#28222d");
    gradient.addColorStop(1, "#173d3a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(240,82,69,.14)";
    ctx.beginPath(); ctx.arc(width * .9, 90, 260, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.04)";
    for (let x = 34; x < width; x += 42) for (let y = 32; y < height; y += 42) {
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f05245";
    ctx.font = '800 22px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText(heading.eyebrow || "MY ANIME PROFILE", 64, 72);
    ctx.fillStyle = "#fffdf8";
    ctx.font = '700 54px Georgia, "Microsoft YaHei", serif';
    ctx.fillText(heading.title || "动画生涯个人喜好表", 64, 132);
    if (pageTotal > 1) {
      ctx.textAlign = "right";
      ctx.font = '700 21px "Segoe UI", sans-serif';
      ctx.fillStyle = "rgba(255,255,255,.62)";
      ctx.fillText(`${String(pageNumber).padStart(2, "0")} / ${String(pageTotal).padStart(2, "0")}`, width - 64, 78);
    }
    ctx.textAlign = "right";
    ctx.font = '600 18px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = "rgba(255,255,255,.48)";
    ctx.fillText("番迹 · ANIME ATLAS", width - 64, height - 34);
    if (heading.qr?.naturalWidth) {
      ctx.save();
      fillRoundedRect(ctx, 64, height - 118, 84, 84, 10, "#fffdf8");
      ctx.drawImage(heading.qr, 70, height - 112, 72, 72);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,.66)";
      ctx.font = '600 16px "Microsoft YaHei", sans-serif';
      ctx.fillText("扫码进入", 164, height - 72);
      ctx.restore();
    }
  }

  async function drawShareListCard(ctx, list, x, y, width, height, includeNotes = false, compact = false) {
    const entries = shareEntriesForList(list);
    const [soft, accent] = shareGroupPalette(list.group);
    fillRoundedRect(ctx, x, y, width, height, compact ? 24 : 28, soft);
    ctx.fillStyle = accent;
    fillRoundedRect(ctx, x + 22, y + 22, compact ? 50 : 58, compact ? 50 : 58, 18, accent);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${compact ? 24 : 30}px "Segoe UI Emoji", "Microsoft YaHei"`;
    ctx.fillText(list.icon, x + (compact ? 47 : 51), y + (compact ? 47 : 51));
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#1d1920";
    ctx.font = `800 ${compact ? 28 : 34}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(fitCanvasText(ctx, list.title, compact ? width - 110 : width - 380), x + (compact ? 86 : 96), y + (compact ? 55 : 60));
    const description = list.custom ? String(list.description || "").trim() : "";
    if (description) {
      ctx.fillStyle = "#6d6570";
      ctx.font = `500 ${compact ? 17 : 20}px "Microsoft YaHei", sans-serif`;
      const descWidth = compact ? width - 52 : width - 405;
      wrapCanvasText(ctx, description, descWidth, compact ? 2 : 2).forEach((line, index) => ctx.fillText(line, x + 26, y + (compact ? 103 : 112) + index * (compact ? 24 : 28)));
    }
    const titles = entries.slice(0, compact ? 2 : 3).map(({ item }) => item.title);
    ctx.fillStyle = "#28222b";
    ctx.font = `700 ${compact ? 18 : 21}px "Microsoft YaHei", sans-serif`;
    if (!titles.length) {
      ctx.fillStyle = "#9b929d";
      ctx.fillText("等待你的答案", x + 26, y + height - 31);
    } else {
      const titleLine = titles.join(" · ") + (entries.length > titles.length ? ` · ＋${entries.length - titles.length}` : "");
      ctx.fillText(fitCanvasText(ctx, titleLine, compact ? width - 52 : width - 410), x + 26, y + height - 31);
    }
    if (includeNotes) {
      const note = entries.map(({ record }) => record.note).find(Boolean);
      if (note) {
        ctx.fillStyle = accent;
        ctx.font = `600 ${compact ? 15 : 17}px "Microsoft YaHei", sans-serif`;
        ctx.fillText(fitCanvasText(ctx, `“${note}”`, compact ? width - 52 : width - 410), x + 26, y + height - 60);
      }
    }
    if (!compact) {
      const posterStart = x + width - 348;
      const posters = entries.slice(0, 3);
      if (!posters.length) {
        fillRoundedRect(ctx, posterStart + 102, y + 24, 118, height - 48, 18, "rgba(255,255,255,.56)");
        ctx.fillStyle = accent;
        ctx.textAlign = "center";
        ctx.font = '400 44px "Segoe UI", sans-serif';
        ctx.fillText("＋", posterStart + 161, y + height / 2 + 14);
      } else {
        for (let index = posters.length - 1; index >= 0; index -= 1) {
          const { item } = posters[index];
          const posterWidth = index === 0 ? 132 : 100;
          const posterHeight = index === 0 ? height - 34 : height - 62;
          const px = posterStart + index * 86;
          const py = y + (index === 0 ? 17 : 31);
          ctx.save();
          ctx.translate(px + posterWidth / 2, py + posterHeight / 2);
          ctx.rotate((index - 1) * .035);
          ctx.translate(-(px + posterWidth / 2), -(py + posterHeight / 2));
          drawPoster(ctx, item, await loadShareImage(item.poster), px, py, posterWidth, posterHeight, 15);
          ctx.restore();
        }
      }
    } else if (entries[0]) {
      drawPoster(ctx, entries[0].item, await loadShareImage(entries[0].item.poster), x + width - 132, y + 82, 106, height - 108, 15);
    }
  }

  async function createAlbumCanvases(lists, options) {
    const pageChunks = [];
    for (let index = 0; index < lists.length; index += 5) pageChunks.push(lists.slice(index, index + 5));
    if (!pageChunks.length) pageChunks.push([]);
    const canvases = [];
    const qr = await loadShareQr();
    for (let pageIndex = 0; pageIndex < pageChunks.length; pageIndex += 1) {
      const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1440;
      const ctx = canvas.getContext("2d");
      drawShareBackground(ctx, 1080, 1440, pageIndex + 1, pageChunks.length, { qr });
      const chunk = pageChunks[pageIndex];
      if (!chunk.length) {
        ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.textAlign = "center"; ctx.font = '600 30px "Microsoft YaHei"';
        ctx.fillText("还没有填写主题，先从最有感觉的一题开始吧", 540, 720);
      }
      for (let index = 0; index < chunk.length; index += 1) await drawShareListCard(ctx, chunk[index], 64, 168 + index * 238, 952, 212, options.notes);
      canvases.push(canvas);
    }
    return canvases;
  }

  async function createStoryCanvas(lists, options) {
    const chosen = lists.filter((list) => list.records.length).slice(0, 8);
    const visible = chosen.length ? chosen : lists.slice(0, 8);
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    drawShareBackground(ctx, 1080, 1920, 1, 1, { qr: await loadShareQr() });
    ctx.fillStyle = "rgba(255,255,255,.64)"; ctx.font = '500 21px "Microsoft YaHei"';
    ctx.fillText(`已回答 ${answeredThemeCount()} / ${mainThemeLists().length} · 我的八个动画关键词`, 66, 170);
    for (let index = 0; index < visible.length; index += 1) {
      const column = index % 2; const row = Math.floor(index / 2);
      await drawShareListCard(ctx, visible[index], 64 + column * 486, 205 + row * 392, 454, 360, options.notes, true);
    }
    return canvas;
  }

  async function createLongCanvas(lists, options) {
    const cardHeight = 190;
    const height = Math.max(900, 196 + lists.length * (cardHeight + 18) + 72);
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = height;
    const ctx = canvas.getContext("2d");
    drawShareBackground(ctx, 1080, height, 1, 1, { qr: await loadShareQr() });
    for (let index = 0; index < lists.length; index += 1) await drawShareListCard(ctx, lists[index], 64, 166 + index * (cardHeight + 18), 952, cardHeight, options.notes);
    return canvas;
  }

  async function createAnnualCanvas(list, options) {
    const entries = shareEntriesForList(list).slice(0, 10);
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1440;
    const ctx = canvas.getContext("2d");
    drawShareBackground(ctx, 1080, 1440, 1, 1, { eyebrow: "ANNUAL TOP TEN", title: `${state.themeYear} 年度十佳`, qr: await loadShareQr() });
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    if (entries.length) {
      const best = entries[0];
      const bestWidth = 228;
      const bestHeight = 342;
      const bestX = (1080 - bestWidth) / 2;
      const bestY = 190;
      ctx.save();
      const halo = ctx.createRadialGradient(540, bestY + bestHeight * .48, 20, 540, bestY + bestHeight * .48, 245);
      halo.addColorStop(0, "rgba(255,211,94,.34)");
      halo.addColorStop(.55, "rgba(240,82,69,.16)");
      halo.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(540, bestY + bestHeight * .48, 245, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,217,112,.74)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 12]);
      ctx.beginPath();
      ctx.ellipse(540, bestY + bestHeight * .5, 176, 222, -.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffd970";
      ctx.textAlign = "center";
      ctx.font = '700 34px Georgia, serif';
      ctx.fillText("✦   ♛   ✦", 540, bestY - 18);
      ctx.restore();
      drawPoster(ctx, best.item, await loadShareImage(best.item.poster), bestX, bestY, bestWidth, bestHeight, 20);
      ctx.save();
      ctx.strokeStyle = "rgba(255,217,112,.96)";
      ctx.lineWidth = 5;
      roundedRect(ctx, bestX - 5, bestY - 5, bestWidth + 10, bestHeight + 10, 24);
      ctx.stroke();
      ctx.restore();
    }

    const supplements = entries.slice(1);
    const posterWidth = 160;
    const posterHeight = 240;
    const columnGap = 46;
    const rowStep = 268;
    for (let index = 0; index < supplements.length; index += 1) {
      const row = Math.floor(index / 3);
      const column = index % 3;
      const rowCount = Math.min(3, supplements.length - row * 3);
      const rowWidth = rowCount * posterWidth + Math.max(0, rowCount - 1) * columnGap;
      const startX = (1080 - rowWidth) / 2;
      const x = startX + column * (posterWidth + columnGap);
      const y = 558 + row * rowStep;
      const entry = supplements[index];
      drawPoster(ctx, entry.item, await loadShareImage(entry.item.poster), x, y, posterWidth, posterHeight, 15);
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.font = '700 16px "Microsoft YaHei"';
      wrapCanvasText(ctx, entry.item.title, posterWidth, 2).forEach((line, lineIndex) => ctx.fillText(line, x, y + posterHeight + 23 + lineIndex * 20));
    }
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片生成失败")), "image/png", .96));
  }

  function clearShareExports() {
    shareExports.forEach((item) => URL.revokeObjectURL(item.url));
    shareExports = [];
  }

  async function openAnnualShareStudio() {
    const list = annualThemeList();
    if (!list || !visibleThemeRecords(list).length) return showToast("请先选出至少一部年度作品", "error");
    elements.shareDialog.classList.add("is-annual-only");
    elements.shareDialog.querySelector(".share-dialog-header .eyebrow").textContent = "ANNUAL TOP TEN";
    elements.shareDialog.querySelector("#shareDialogTitle").textContent = `${state.themeYear} 年度十佳分享图`;
    elements.shareDialog.querySelector(".share-dialog-header p:last-child").textContent = "按年度最佳与九部补充重新排版为一张 3:4 高清 PNG。";
    elements.downloadShareImages.disabled = true;
    elements.shareStatus.textContent = "正在读取海报并生成年度分享图…";
    elements.sharePreviewList.innerHTML = `<div class="share-preview-empty is-loading"><span>✦</span><p>正在生成高清图片</p></div>`;
    if (!elements.shareDialog.open) elements.shareDialog.showModal();
    try {
      await prepareShareImages([list]);
      const canvas = await createAnnualCanvas(list, {});
      const blob = await canvasToBlob(canvas);
      clearShareExports();
      const date = new Date().toISOString().slice(0, 10);
      shareExports = [{
        blob,
        url: URL.createObjectURL(blob),
        name: `${Core.safeFileName(`${SHARE_FILE_PREFIX}-${state.themeYear}年度十佳`)}-${date}.png`,
      }];
      const canShareFiles = typeof navigator.share === "function" && typeof File === "function";
      elements.sharePreviewList.innerHTML = `<article class="share-preview-item"><img src="${escapeHtml(shareExports[0].url)}" alt="${state.themeYear}年度十佳分享图预览" /><div><span>3:4 高清 PNG · ${Math.round(blob.size / 1024).toLocaleString("zh-CN")} KB</span><div class="share-item-actions"><button type="button" data-download-share="0">保存图片</button>${canShareFiles ? `<button type="button" data-native-share="0">直接分享</button>` : ""}</div></div></article>`;
      elements.shareStatus.textContent = "年度分享图已生成，可保存或直接分享。";
      elements.downloadShareImages.disabled = false;
    } catch (error) {
      console.error(error);
      elements.shareStatus.textContent = "生成失败，请稍后重试。";
      elements.sharePreviewList.innerHTML = `<div class="share-preview-empty"><span>!</span><p>图片生成失败，请重新尝试</p></div>`;
      showToast("年度分享图生成失败", "error");
    }
  }

  async function generateShareImageExports() {
    const template = document.querySelector('input[name="shareTemplate"]:checked')?.value || "album";
    const options = {
      notes: elements.shareIncludeNotes.checked,
    };
    let lists = mainThemeLists();
    if (!elements.shareShowEmpty.checked) lists = lists.filter((list) => list.records.length > 0);
    elements.generateShareImages.disabled = true;
    elements.downloadShareImages.disabled = true;
    elements.shareStatus.textContent = "正在读取海报并排版，请稍候…";
    elements.sharePreviewList.innerHTML = `<div class="share-preview-empty is-loading"><span>✦</span><p>正在生成高清图片</p></div>`;
    try {
      await prepareShareImages(lists);
      const canvases = template === "story"
        ? [await createStoryCanvas(lists, options)]
        : template === "long" ? [await createLongCanvas(lists, options)] : await createAlbumCanvases(lists, options);
      const labels = canvases.map((_, index) => template === "album" ? `图册-${String(index + 1).padStart(2, "0")}` : template === "story" ? "竖版精选" : "完整长图");
      clearShareExports();
      const blobs = await Promise.all(canvases.map(canvasToBlob));
      const date = new Date().toISOString().slice(0, 10);
      shareExports = blobs.map((blob, index) => ({ blob, url: URL.createObjectURL(blob), name: `${Core.safeFileName(`${SHARE_FILE_PREFIX}-${labels[index]}`)}-${date}.png` }));
      const canShareFiles = typeof navigator.share === "function" && typeof File === "function";
      elements.sharePreviewList.innerHTML = shareExports.map((item, index) => `<article class="share-preview-item"><img src="${escapeHtml(item.url)}" alt="分享图第${index + 1}张预览" /><div><span>第 ${index + 1} 张 · ${Math.round(item.blob.size / 1024).toLocaleString("zh-CN")} KB</span><div class="share-item-actions"><button type="button" data-download-share="${index}">保存这张</button>${canShareFiles ? `<button type="button" data-native-share="${index}">直接分享</button>` : ""}</div></div></article>`).join("");
      elements.shareStatus.textContent = `已生成 ${shareExports.length} 张高清 PNG，可逐张保存或全部下载。`;
      elements.downloadShareImages.disabled = false;
    } catch (error) {
      console.error(error);
      elements.shareStatus.textContent = "生成失败，请稍后重试。";
      elements.sharePreviewList.innerHTML = `<div class="share-preview-empty"><span>!</span><p>图片生成失败，请重新尝试</p></div>`;
      showToast("分享图生成失败", "error");
    } finally {
      elements.generateShareImages.disabled = false;
    }
  }

  function downloadShareExport(item) {
    if (!item) return;
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.name;
    document.body.append(link);
    link.click();
    link.remove();
  }

  async function nativeShareExport(item) {
    if (!item || typeof navigator.share !== "function") return showToast("当前浏览器不支持直接分享，请先保存图片", "error");
    try {
      const file = new File([item.blob], item.name, { type: "image/png" });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) throw new Error("files unsupported");
      await navigator.share({ title: "我的动画生涯个人喜好表", files: [file] });
    } catch (error) {
      if (error?.name !== "AbortError") showToast("无法直接分享，请先保存图片", "error");
    }
  }

  function showView(view) {
    state.view = ["browse", "swipe", "collection", "themes", "annual"].includes(view) ? view : "swipe";
    setMobileNavOpen(false);
    document.body.classList.toggle("swipe-mode-active", state.view === "swipe");
    elements.browseView.hidden = state.view !== "browse";
    elements.swipeView.hidden = state.view !== "swipe";
    elements.collectionView.hidden = state.view !== "collection";
    elements.themesView.hidden = state.view !== "themes";
    elements.annualView.hidden = state.view !== "annual";
    elements.originSwitchShell.hidden = state.view !== "browse";
    elements.timelineShell.hidden = ["swipe", "collection", "themes", "annual"].includes(state.view);
    elements.navButtons.forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    renderTimeline(true);
    if (state.view === "swipe") {
      prepareSwipeQueue();
      renderSwipeFilterControls();
      renderSwipeDeck();
    }
    if (state.view === "collection") renderCollection();
    if (state.view === "themes") renderThemes();
    if (state.view === "annual") renderAnnualView();
    closeDrawer();
    document.querySelector(`#${state.view}View`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    updateFloatingCatalogMode();
  }

  function renderCollection() {
    const items = [...selected.values()];
    const filteredItems = Core.filterAnime(items, {
      period: state.collectionPeriod,
      type: state.collectionType,
      season: state.collectionSeason,
      query: "",
    });
    const stats = Core.collectionStats(items);
    const typeSummary = ["tv", "web", "movie", "theatrical", "other"]
      .map((key) => `<span><b>${stats.types[key]}</b><small>${TYPE_LABELS[key]}</small></span>`)
      .join("");
    const collectionRange = stats.earliest
      ? stats.earliest === stats.latest ? `${stats.earliest}年` : `${stats.earliest}—${stats.latest}`
      : stats.total ? "记录年份待补" : "等待第一部记录";

    elements.collectionOverview.innerHTML = `
      <div class="overview-main">
        <span>已看作品</span>
        <strong>${stats.total}</strong>
        <small>${collectionRange}</small>
      </div>
      <div class="overview-types">${typeSummary}</div>`;

    renderCollectionInsights(items, stats);
    renderCollectionGrouping(items, filteredItems);
    renderCollectionGallery(filteredItems, items.length > 0);
    renderCollectionMode();

    const undatedPeriod = { key: "undated", label: "日期待补", shortLabel: "待补", kind: "undated" };
    const availablePeriods = items.some((item) => !Number.isInteger(item.year))
      ? [...Core.PERIODS, undatedPeriod]
      : Core.PERIODS;
    const visiblePeriods = state.collectionPeriod === "all"
      ? availablePeriods
      : availablePeriods.filter((period) => period.key === state.collectionPeriod);
    elements.historyTableBody.innerHTML = visiblePeriods.map((period) => {
      const periodItems = filteredItems.filter((item) => Core.matchesPeriod(item, period.key));
      if (period.kind !== "year") return renderDecadeRow(period, periodItems);
      return renderYearRow(period, periodItems);
    }).join("");
  }

  function renderCollectionGrouping(items, filteredItems) {
    const period = Core.PERIODS.find((candidate) => candidate.key === state.collectionPeriod);
    const periodItems = state.collectionPeriod === "all"
      ? items
      : items.filter((item) => Core.matchesPeriod(item, state.collectionPeriod));
    const typeCounts = Object.fromEntries(Core.TYPES.map((type) => [
      type.key,
      type.key === "all" ? periodItems.length : periodItems.filter((item) => item.type === type.key).length,
    ]));
    const television = periodItems.filter((item) => item.type === "tv");

    elements.collectionTypeFilters.innerHTML = Core.TYPES.map((type) => `
      <button
        type="button"
        class="segment-button${state.collectionType === type.key ? " is-active" : ""}"
        data-collection-type="${type.key}"
        aria-pressed="${state.collectionType === type.key}"
      ><span>${escapeHtml(type.label)}</span><small>${typeCounts[type.key]}</small></button>`).join("");

    elements.collectionSeasonFilters.innerHTML = Core.SEASONS.map((season) => {
      const count = season.key === "all"
        ? television.length
        : television.filter((item) => item.season === season.key).length;
      return `
        <button
          type="button"
          class="segment-button${state.collectionSeason === season.key ? " is-active" : ""}"
          data-collection-season="${season.key}"
          aria-pressed="${state.collectionSeason === season.key}"
        ><span>${escapeHtml(season.label)}</span><small>${count}</small></button>`;
    }).join("");

    elements.collectionSeasonRow.hidden = state.collectionType !== "tv";
    elements.collectionFilterCount.textContent = filteredItems.length.toLocaleString("zh-CN");
    const labels = [state.collectionPeriod === "undated" ? "日期待补" : period?.label || "全部年份"];
    if (state.collectionType !== "all") labels.push(TYPE_LABELS[state.collectionType]);
    if (state.collectionSeason !== "all") labels.push(SEASON_LABELS[state.collectionSeason]);
    elements.collectionFilterScope.textContent = labels.join(" · ");
    const filtersActive = state.collectionPeriod !== "all"
      || state.collectionType !== "all"
      || state.collectionSeason !== "all";
    elements.clearCollectionFilters.hidden = !filtersActive;
    elements.clearCollectionFilters.disabled = false;
  }

  function collectionRuntime(items) {
    let minutes = 0;
    let covered = 0;
    let estimated = 0;
    items.forEach((item) => {
      const episodes = item.episodeCount || 1;
      if (item.runtimeMinutes) {
        minutes += item.runtimeMinutes * episodes;
        covered += 1;
      } else if (item.type === "tv" && item.episodeCount) {
        minutes += 24 * item.episodeCount;
        covered += 1;
        estimated += 1;
      }
    });
    return { minutes, covered, estimated };
  }

  function formatRuntime(minutes) {
    if (!minutes) return "等待记录";
    const days = Math.floor(minutes / 1440);
    const hours = Math.round((minutes % 1440) / 60);
    return days ? `约 ${days} 天 ${hours} 小时` : `约 ${hours} 小时`;
  }

  function franchiseRoot(item) {
    return String(item.title || "")
      .normalize("NFKC")
      .replace(/剧场版|劇場版|动画电影|OVA|THE MOVIE|映画/gi, " ")
      .replace(/第\s*[一二三四五六七八九十\d]+\s*(?:季|期|章|部|话|話)/g, " ")
      .replace(/(?:Season|Part)\s*\d+/gi, " ")
      .split(/[：:～~—–]|\s{2,}/)[0]
      .trim();
  }

  function deepestFranchise(items) {
    const groups = new Map();
    items.forEach((item) => {
      const label = franchiseRoot(item);
      const key = Core.normalizeText(label);
      if (key.length < 3) return;
      const group = groups.get(key) || { label, items: [] };
      group.items.push(item);
      groups.set(key, group);
    });
    return [...groups.values()].sort((a, b) => b.items.length - a.items.length)[0] || null;
  }

  function rankedCollectionTags(items) {
    const tags = new Map();
    items.forEach((item) => {
      const seen = new Set();
      item.bangumiTags.forEach((tag) => {
        const key = Core.normalizeText(tag.name);
        if (!key || seen.has(key) || TAG_STATS_EXCLUSIONS.has(key)) return;
        seen.add(key);
        const current = tags.get(key) || { name: tag.name, works: 0, communityCount: 0 };
        current.works += 1;
        current.communityCount += tag.count || 0;
        tags.set(key, current);
      });
    });
    return [...tags.values()].sort((a, b) => (
      b.works - a.works
      || b.communityCount - a.communityCount
      || a.name.localeCompare(b.name, "zh-CN")
    ));
  }

  function collectionTagCloud(items) {
    const ranked = rankedCollectionTags(items);
    const repeated = ranked.filter((tag) => tag.works > 1);
    const singleUse = ranked.filter((tag) => tag.works === 1);
    const words = (repeated.length >= 8 ? [...repeated, ...singleUse] : ranked).slice(0, 72);
    const min = Math.min(...words.map((tag) => tag.works), 1);
    const max = Math.max(...words.map((tag) => tag.works), 1);
    return words.map((tag, index) => {
      const ratio = max === min ? 0.45 : (tag.works - min) / (max - min);
      return {
        ...tag,
        size: Math.round(15 + Math.sqrt(ratio) * 43),
        tone: index % 6,
      };
    });
  }

  function wordCloudShapeLabel(shapeKey) {
    return WORD_CLOUD_SHAPES.find((shape) => shape.key === shapeKey)?.label || "猫猫";
  }

  function randomizeWordCloudShape() {
    const alternatives = WORD_CLOUD_SHAPES.filter((shape) => shape.key !== state.wordCloudShape);
    state.wordCloudShape = alternatives[Math.floor(Math.random() * alternatives.length)].key;
  }

  function traceWordCloudShape(context, shapeKey, width, height) {
    const ellipse = (x, y, radiusX, radiusY, rotation = 0) => {
      context.beginPath();
      context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2);
      context.fill();
    };
    const polygon = (points) => {
      context.beginPath();
      points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
      context.closePath();
      context.fill();
    };
    const centerX = width / 2;

    if (shapeKey === "cloud") {
      ellipse(240, 314, 145, 112);
      ellipse(352, 235, 164, 154);
      ellipse(500, 222, 175, 172);
      ellipse(650, 302, 155, 126);
      context.fillRect(200, 292, 505, 152);
      return;
    }

    if (shapeKey === "heart") {
      context.beginPath();
      context.moveTo(centerX, 494);
      context.bezierCurveTo(402, 448, 110, 286, 145, 132);
      context.bezierCurveTo(174, 4, 367, 29, centerX, 165);
      context.bezierCurveTo(533, 29, 726, 4, 755, 132);
      context.bezierCurveTo(790, 286, 498, 448, centerX, 494);
      context.closePath();
      context.fill();
      return;
    }

    if (shapeKey === "lightning") {
      polygon([
        [422, 35], [170, 302], [342, 302], [238, 525],
        [708, 220], [503, 220], [621, 35],
      ]);
      return;
    }

    if (shapeKey === "sakura") {
      const petals = [
        [centerX, 164, 84, 155, 0],
        [578, 250, 84, 155, 1.26],
        [530, 397, 84, 155, 2.52],
        [370, 397, 84, 155, -2.52],
        [322, 250, 84, 155, -1.26],
      ];
      petals.forEach(([x, y, rx, ry, rotation]) => ellipse(x, y, rx, ry, rotation));
      ellipse(centerX, 308, 88, 82);
      return;
    }

    if (shapeKey === "magic") {
      context.save();
      context.beginPath();
      context.arc(centerX, 280, 248, 0, Math.PI * 2);
      context.arc(centerX, 280, 165, 0, Math.PI * 2, true);
      context.fill("evenodd");
      const star = [];
      for (let index = 0; index < 10; index += 1) {
        const radius = index % 2 ? 72 : 158;
        const angle = -Math.PI / 2 + index * Math.PI / 5;
        star.push([centerX + Math.cos(angle) * radius, 280 + Math.sin(angle) * radius]);
      }
      polygon(star);
      context.restore();
      return;
    }

    if (shapeKey === "moonwing") {
      context.beginPath();
      context.arc(centerX, 275, 208, Math.PI * 0.31, Math.PI * 1.69);
      context.arc(centerX + 102, 275, 170, Math.PI * 1.61, Math.PI * 0.39, true);
      context.closePath();
      context.fill();
      polygon([[315, 214], [94, 124], [180, 242], [72, 280], [252, 326], [128, 418], [348, 363]]);
      polygon([[585, 214], [806, 124], [720, 242], [828, 280], [648, 326], [772, 418], [552, 363]]);
      return;
    }

    if (shapeKey === "title") {
      context.save();
      context.font = '900 270px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("番迹", centerX, 278);
      context.fillRect(178, 430, 544, 38);
      context.restore();
      return;
    }

    // 坐姿猫剪影：圆润的头身、双耳、前爪与卷尾共同组成连续遮罩。
    polygon([[335, 170], [292, 42], [407, 113], [493, 113], [608, 42], [565, 170]]);
    ellipse(centerX, 192, 142, 123);
    ellipse(centerX, 367, 165, 169);
    ellipse(393, 453, 61, 92, 0.08);
    ellipse(507, 453, 61, 92, -0.08);
    context.save();
    context.lineWidth = 68;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(570, 414);
    context.bezierCurveTo(744, 518, 792, 339, 684, 282);
    context.stroke();
    context.restore();
  }

  function renderShapedWordCloud(canvas, words, shapeKey) {
    if (!canvas || !words.length) return;
    const width = 900;
    const height = 560;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.dataset.wordCloudShape = shapeKey;
    const context = canvas.getContext("2d");
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const mask = document.createElement("canvas");
    mask.width = width;
    mask.height = height;
    const maskContext = mask.getContext("2d", { willReadFrequently: true });
    maskContext.fillStyle = "#000";
    maskContext.strokeStyle = "#000";
    traceWordCloudShape(maskContext, shapeKey, width, height);

    const cellSize = 4;
    const columns = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    const maskPixels = maskContext.getImageData(0, 0, width, height).data;
    const blockedIntegral = new Uint32Array((columns + 1) * (rows + 1));
    for (let row = 0; row < rows; row += 1) {
      let rowBlocked = 0;
      for (let column = 0; column < columns; column += 1) {
        const sampleX = Math.min(width - 1, column * cellSize + Math.floor(cellSize / 2));
        const sampleY = Math.min(height - 1, row * cellSize + Math.floor(cellSize / 2));
        rowBlocked += maskPixels[(sampleY * width + sampleX) * 4 + 3] < 128 ? 1 : 0;
        blockedIntegral[(row + 1) * (columns + 1) + column + 1] = blockedIntegral[row * (columns + 1) + column + 1] + rowBlocked;
      }
    }
    const blockedCount = (left, top, right, bottom) => (
      blockedIntegral[bottom * (columns + 1) + right]
      - blockedIntegral[top * (columns + 1) + right]
      - blockedIntegral[bottom * (columns + 1) + left]
      + blockedIntegral[top * (columns + 1) + left]
    );
    const occupancy = new Uint8Array(columns * rows);
    const isAvailable = (left, top, right, bottom) => {
      if (left < 0 || top < 0 || right > columns || bottom > rows || blockedCount(left, top, right, bottom)) return false;
      for (let row = top; row < bottom; row += 1) {
        const rowStart = row * columns;
        for (let column = left; column < right; column += 1) {
          if (occupancy[rowStart + column]) return false;
        }
      }
      return true;
    };
    const occupy = (left, top, right, bottom) => {
      for (let row = top; row < bottom; row += 1) {
        occupancy.fill(1, row * columns + left, row * columns + right);
      }
    };
    const palette = ["#d94d51", "#147f79", "#7557ad", "#b47708", "#326a9e", "#9a496d", "#2f7e56", "#d66834"];
    const shapeSeed = [...shapeKey].reduce((total, character) => total + character.charCodeAt(0), 0);

    // 先铺一层被遮罩严格裁切的微型标签纹理，保证轮廓的边缘、尖角和孔洞都由文字界定。
    const texture = document.createElement("canvas");
    texture.width = width;
    texture.height = height;
    const textureContext = texture.getContext("2d");
    let textureWordIndex = 0;
    for (let row = 0, y = 11; y < height + 14; row += 1, y += 14) {
      let x = -80 - ((row * 37 + shapeSeed) % 94);
      while (x < width + 90) {
        const word = words[(textureWordIndex * 5 + row * 3) % words.length];
        const fontSize = 8 + Math.min(5, Math.round((word.size - 15) / 9));
        textureContext.font = `750 ${fontSize}px "Microsoft YaHei UI", "PingFang SC", sans-serif`;
        const textWidth = Math.max(12, textureContext.measureText(word.name).width);
        const tilt = ((textureWordIndex + row) % 7 - 3) * 0.018;
        textureContext.save();
        textureContext.translate(x + textWidth / 2, y);
        textureContext.rotate(tilt);
        textureContext.fillStyle = palette[(word.tone + row) % palette.length];
        textureContext.globalAlpha = 0.62;
        textureContext.textAlign = "center";
        textureContext.textBaseline = "middle";
        textureContext.fillText(word.name, 0, 0);
        textureContext.restore();
        x += textWidth + 7 + ((textureWordIndex * 11 + row) % 9);
        textureWordIndex += 1;
      }
    }
    textureContext.globalCompositeOperation = "destination-in";
    textureContext.drawImage(mask, 0, 0);
    context.drawImage(texture, 0, 0);

    const placeWord = (word, wordIndex, filler = false) => {
      const nameSeed = [...word.name].reduce((total, character) => ((total * 31 + character.charCodeAt(0)) >>> 0), shapeSeed + wordIndex);
      let placed = false;
      const shrinkLimit = filler ? 4 : 6;
      for (let shrink = 0; shrink < shrinkLimit && !placed; shrink += 1) {
        const fillerSize = 9 + Math.min(7, Math.round((word.size - 15) / 7));
        const fontSize = Math.max(filler ? 8 : 12, Math.round((filler ? fillerSize : word.size) * (0.92 ** shrink)));
        context.font = `800 ${fontSize}px "Microsoft YaHei UI", "PingFang SC", sans-serif`;
        const measuredWidth = Math.ceil(context.measureText(word.name).width);
        const preferVertical = shapeKey === "lightning" ? wordIndex % 2 === 1 : nameSeed % (filler ? 4 : 7) === 0;
        for (let orientation = 0; orientation < 2 && !placed; orientation += 1) {
          const vertical = orientation ? !preferVertical : preferVertical;
          const padding = filler ? 2 : 5;
          const wordWidth = vertical ? fontSize + padding : measuredWidth + padding;
          const wordHeight = vertical ? measuredWidth + padding : fontSize * 1.18 + padding;
          const cellWidth = Math.ceil(wordWidth / cellSize);
          const cellHeight = Math.ceil(wordHeight / cellSize);
          const attemptLimit = filler ? 2400 : 6200;
          for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
            let x;
            let y;
            if (!filler || attempt < 320) {
              const angle = attempt * 0.39 + (nameSeed % 360) * Math.PI / 180;
              const radius = 3.75 * Math.sqrt(attempt);
              x = width / 2 + Math.cos(angle) * radius * 1.34;
              y = height / 2 + Math.sin(angle) * radius * 0.91;
            } else {
              const hashX = Math.imul((nameSeed + wordIndex * 101 + attempt) >>> 0, 2654435761) >>> 0;
              const hashY = Math.imul((nameSeed + wordIndex * 313 + attempt * 17) >>> 0, 1597334677) >>> 0;
              x = (hashX / 4294967295) * width;
              y = (hashY / 4294967295) * height;
            }
            const left = Math.floor((x - wordWidth / 2) / cellSize);
            const top = Math.floor((y - wordHeight / 2) / cellSize);
            const right = left + cellWidth;
            const bottom = top + cellHeight;
            if (!isAvailable(left, top, right, bottom)) continue;
            occupy(left, top, right, bottom);
            context.save();
            context.translate((left + cellWidth / 2) * cellSize, (top + cellHeight / 2) * cellSize);
            if (vertical) context.rotate(-Math.PI / 2);
            context.strokeStyle = "rgb(255 255 255 / 76%)";
            context.lineWidth = Math.max(2, fontSize * 0.12);
            context.lineJoin = "round";
            context.strokeText(word.name, 0, 0);
            context.fillStyle = palette[word.tone % palette.length];
            context.globalAlpha = filler ? 0.82 : 1;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(word.name, 0, 0);
            context.restore();
            placed = true;
            break;
          }
        }
      }
      return placed;
    };

    // 唯一标签以大字号覆盖在纹理上，形成清晰的视觉重点。
    words.forEach((word, wordIndex) => placeWord(word, wordIndex));
    context.globalAlpha = 1;
  }

  function popularityExtremes(items) {
    const compare = (left, right) => (
      left.voteCount - right.voteCount
      || left.bangumiTagTotal - right.bangumiTagTotal
      || left.title.localeCompare(right.title, "zh-CN")
    );
    const ranked = [...items].sort(compare);
    return { coldest: ranked[0], hottest: ranked.at(-1) };
  }

  function renderPopularityExtreme(item, kind) {
    const poster = safeUrl(item.poster);
    const hottest = kind === "hottest";
    return `
      <article class="popularity-extreme popularity-extreme--${kind}">
        <span class="popularity-poster${poster ? "" : " has-fallback"}">
          ${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ""}
          <b>${escapeHtml(item.title.slice(0, 1))}</b>
          <em>${hottest ? "HOT" : "HIDDEN GEM"}</em>
        </span>
        <div>
          <span>${hottest ? "生涯表中最热门" : "生涯表中最冷门"}</span>
          <strong>${titleLink(item, "anime-title-link insight-title-link")}</strong>
          <p>${item.voteCount.toLocaleString("zh-CN")} 人评分 · 全部标签累计 ${item.bangumiTagTotal.toLocaleString("zh-CN")} 次标注</p>
        </div>
      </article>`;
  }

  function renderCollectionInsights(items, stats) {
    if (!items.length) {
      elements.collectionInsights.innerHTML = `
        <div class="insight-empty">
          <span>✦</span>
          <div><h3>你的动画总结正在等待第一部作品</h3><p>开始收录后，这里会生成类似年度报告的个人洞察。</p></div>
        </div>`;
      return;
    }

    const runtime = collectionRuntime(items);
    const years = new Map();
    items.forEach((item) => {
      if (Number.isInteger(item.year)) years.set(item.year, (years.get(item.year) || 0) + 1);
    });
    const busiest = [...years.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] || null;
    const franchise = deepestFranchise(items);
    const franchiseReady = franchise && franchise.items.length > 1;
    const franchiseWorks = franchiseReady
      ? [...franchise.items].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title, "zh-CN"))
      : [];
    const franchiseWorkCards = franchiseWorks.map((item) => {
      const poster = safeUrl(item.poster);
      return `
        <div class="franchise-work">
          <span class="franchise-poster${poster ? "" : " has-fallback"}">
            ${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ""}
            <b>${escapeHtml(item.title.slice(0, 1))}</b>
          </span>
          <span><b>${titleLink(item, "anime-title-link franchise-title-link")}</b><small>${escapeHtml(item.year ? `${item.year}年` : "日期待补")} · ${escapeHtml(catalogTypeLabel(item))}</small></span>
        </div>`;
    }).join("");
    const runtimeNote = runtime.covered === items.length
      ? "全部作品均有可计算数据"
      : `覆盖 ${runtime.covered}/${items.length} 部；TV 缺少单话时长时按 24 分钟估算`;
    const hasDatedYears = years.size > 0;
    const yearValues = hasDatedYears ? [...years.keys()].sort((a, b) => a - b) : [currentYear];
    const lastYear = yearValues.at(-1);
    const firstYear = state.collectionRecentTenYears ? Math.max(1917, lastYear - 9) : yearValues[0];
    const fullYears = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
    const chartWidth = Math.max(920, fullYears.length * 58);
    const chartHeight = 260;
    const chartLeft = 46;
    const chartRight = 24;
    const chartTop = 22;
    const chartBottom = 38;
    const plotWidth = chartWidth - chartLeft - chartRight;
    const plotHeight = chartHeight - chartTop - chartBottom;
    const maxCount = Math.max(...fullYears.map((year) => years.get(year) || 0), 1);
    const xFor = (year, index) => fullYears.length === 1
      ? chartLeft + plotWidth / 2
      : chartLeft + (index / (fullYears.length - 1)) * plotWidth;
    const yFor = (count) => chartTop + plotHeight - (count / maxCount) * plotHeight;
    const points = fullYears.map((year, index) => `${xFor(year, index).toFixed(1)},${yFor(years.get(year) || 0).toFixed(1)}`).join(" ");
    const yearLabelStep = Math.max(1, Math.ceil(fullYears.length / 12));
    const tickValues = maxCount <= 4
      ? Array.from({ length: maxCount + 1 }, (_, index) => index)
      : [...new Set([0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxCount * ratio)))].sort((a, b) => a - b);
    const gridLines = tickValues.map((value) => {
      const y = yFor(value);
      return `<g><line x1="${chartLeft}" y1="${y}" x2="${chartWidth - chartRight}" y2="${y}" /><text x="${chartLeft - 10}" y="${y + 4}" text-anchor="end">${value}</text></g>`;
    }).join("");
    const yearLabels = fullYears.map((year, index) => (
      index % yearLabelStep === 0 || index === fullYears.length - 1
        ? `<text x="${xFor(year, index)}" y="${chartHeight - 10}" text-anchor="middle">${year}</text>`
        : ""
    )).join("");
    const yearDots = fullYears.map((year, index) => {
      const count = years.get(year) || 0;
      const active = state.collectionPeriod !== "all"
        && Core.matchesPeriod({ year }, state.collectionPeriod);
      const x = xFor(year, index);
      const y = yFor(count);
      return `<g class="chart-point${active ? " is-active" : ""}" data-chart-year="${year}" tabindex="0" role="button" aria-label="${year}年 ${count}部"><circle cx="${x}" cy="${y}" r="${count ? 5 : 3}"></circle><text x="${x}" y="${Math.max(14, y - 11)}" text-anchor="middle">${count}</text><title>${year}年 · ${count}部；点击筛选个人记录</title></g>`;
    }).join("");
    const yearChartBody = hasDatedYears
      ? `<svg class="year-line-chart" style="width:${chartWidth}px" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="${firstYear}年至${lastYear}年观看数量折线图" data-first-chart-year="${firstYear}" data-last-chart-year="${lastYear}">
          <g class="chart-grid-lines">${gridLines}</g>
          <polyline points="${points}" />
          <g class="chart-year-labels">${yearLabels}</g>
          <g class="chart-year-dots">${yearDots}</g>
        </svg>`
      : `<div class="year-chart-empty"><strong>这些记录暂时没有年份</strong><span>补齐日期后会自动生成生涯曲线</span></div>`;
    const recommendList = themeLists.find((list) => list.id === "recommend") || { records: [] };
    const recommended = recommendList.records.map((record) => catalogById.get(record.id)).filter(Boolean);
    const recommendedTopTags = recommended.length > 10
      ? rankedCollectionTags(recommended).slice(0, 10)
      : [];
    const recommendMax = Math.max(...recommendedTopTags.map((tag) => tag.works), 1);
    const recommendBars = recommendedTopTags.map((tag, index) => `
      <li>
        <span><i>${index + 1}</i><b>${escapeHtml(tag.name)}</b></span>
        <span class="recommend-tag-track"><em style="--bar-width:${(tag.works / recommendMax * 100).toFixed(2)}%"></em></span>
        <strong>${tag.works} 部</strong>
      </li>`).join("");
    const recommendedTagSummary = recommendedTopTags.length ? `
      <article class="recommended-tag-card">
        <div class="recommended-tag-copy">
          <span>你的安利关键词</span>
          <strong>你推荐的作品中，「${escapeHtml(recommendedTopTags[0].name)}」出现得最多</strong>
          <p>你已经认真推荐了 ${recommended.length} 部作品——已经安利成功多少份了呢？</p>
        </div>
        <ol class="recommended-tag-bars" aria-label="推荐作品中出现次数最多的十项标签横向柱状图">${recommendBars}</ol>
      </article>` : "";
    const extremes = popularityExtremes(items);
    const popularitySummary = `
      <section class="popularity-extremes" aria-label="生涯表热门与冷门作品">
        ${renderPopularityExtreme(extremes.hottest, "hottest")}
        ${renderPopularityExtreme(extremes.coldest, "coldest")}
      </section>`;

    elements.collectionInsights.innerHTML = `
      <div class="summary-chart-grid summary-chart-grid--single">
        <article class="chart-card year-chart-card">
          <div class="chart-card-heading"><div><span>每年观看数量</span><strong>你的动画生涯曲线</strong></div><label class="recent-years-toggle"><input id="collectionRecentYearsToggle" type="checkbox" ${state.collectionRecentTenYears ? "checked" : ""} /><span>仅看最近10年</span></label></div>
          <div class="year-chart-scroller">
            ${yearChartBody}
          </div>
        </article>
      </div>
      <div class="insight-grid summary-metrics">
        <article><span>估算观看时长</span><strong>${escapeHtml(formatRuntime(runtime.minutes))}</strong><small>${escapeHtml(runtimeNote)}</small></article>
        <article><span>看得最密集</span><strong>${busiest ? `${busiest[0]}年` : "日期待补"}</strong><small>${busiest ? `共 ${busiest[1]} 部作品` : "暂时无法按年份统计"}</small></article>
        <article class="insight-franchise">
          <span>可能追得最深的系列</span>
          <strong>${escapeHtml(franchiseReady ? franchise.label : "记录更多后揭晓")}</strong>
          <small>${franchiseReady ? `${franchise.items.length} 部相关作品，看来你真的很喜欢它` : "至少收录两部相关作品后生成"}</small>
          ${franchiseReady ? `<div class="franchise-work-list">${franchiseWorkCards}</div>` : ""}
        </article>
      </div>
      ${popularitySummary}
      ${recommendedTagSummary}`;
    elements.collectionInsights.querySelectorAll(".franchise-poster img").forEach((image) => {
      image.addEventListener("error", () => image.closest(".franchise-poster")?.classList.add("has-fallback"), { once: true });
    });
    elements.collectionInsights.querySelectorAll(".popularity-poster img").forEach((image) => {
      image.addEventListener("error", () => image.closest(".popularity-poster")?.classList.add("has-fallback"), { once: true });
    });
  }

  function renderCollectionGallery(items, hasCollectionItems = false) {
    const sorted = [...items].sort((a, b) => (b.year - a.year) || a.title.localeCompare(b.title, "zh-CN"));
    if (!sorted.length) {
      elements.collectionGallery.innerHTML = `<div class="gallery-empty">${hasCollectionItems
        ? "当前年代与分类下还没有个人记录，可以切换条件继续查看。"
        : "收录作品后，海报会在这里组成你的动画记忆墙。"}</div>`;
      return;
    }
    elements.collectionGallery.innerHTML = sorted.map((item) => {
      const poster = safeUrl(item.poster);
      return `
        <article class="memory-card reaction-${escapeHtml(item.reaction)}" data-theme-context-id="${escapeHtml(item.id)}" tabindex="0">
          <span class="memory-poster${poster ? "" : " has-fallback"}">
            ${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(item.title)}海报" loading="lazy" referrerpolicy="no-referrer" />` : `<b>${escapeHtml(item.title.slice(0, 1))}</b>`}
            <span>${item.year || "待补"}</span>
          </span>
          <div>
            <span class="type-badge type-badge--${item.origin === "cn" ? chineseCategory(item).key : escapeHtml(item.type)}">${escapeHtml(catalogTypeLabel(item))}</span>
            <h4 class="reaction-title reaction-title--${escapeHtml(item.reaction)}">${titleLink(item, "anime-title-link memory-title-link")}</h4>
            <small>${escapeHtml(item.originalTitle || "记忆已收录")}</small>
            ${renderBangumiTags(item)}
          </div>
          <button type="button" data-remove-id="${escapeHtml(item.id)}" aria-label="移除${escapeHtml(item.title)}">×</button>
        </article>`;
    }).join("");
    elements.collectionGallery.querySelectorAll("img").forEach((image) => {
      image.addEventListener("error", () => image.closest(".memory-poster")?.classList.add("has-fallback"), { once: true });
    });
  }

  function isReleasedSwipeCandidate(item, now = new Date()) {
    if (Number.isInteger(item.year) && item.year > now.getFullYear()) return false;
    const match = String(item.releaseDate || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return true;
    const release = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59);
    return release <= now;
  }

  function readSwipeFilters() {
    const presetVotes = elements.swipeMinVotesPreset.value;
    const customVotes = Math.round(Math.min(1000000, Math.max(0, Number(elements.swipeMinVotesCustom.value) || 0)));
    return {
      startYear: Number(elements.swipeStartYear.value),
      minVotes: presetVotes === "custom" ? customVotes : Number(presetVotes),
      minScore: Number(elements.swipeMinScore.value),
      maxScore: Number(elements.swipeMaxScore.value),
      excludeChinese: elements.swipeExcludeChinese.checked,
      excludeWeb: elements.swipeExcludeWeb.checked,
      excludeMovie: elements.swipeExcludeMovie.checked,
      excludeTheatrical: elements.swipeExcludeTheatrical.checked,
      excludeCompilation: elements.swipeExcludeCompilation.checked,
      excludeOther: elements.swipeExcludeOther.checked,
    };
  }

  function renderSwipeFilterControls() {
    const filters = state.swipeFilters;
    elements.swipeStartYear.max = String(currentYear);
    elements.swipeStartYear.value = String(filters.startYear);
    const presetVotes = SWIPE_VOTE_PRESETS.has(filters.minVotes) ? String(filters.minVotes) : "custom";
    elements.swipeMinVotesPreset.value = presetVotes;
    elements.swipeMinVotesCustom.value = String(filters.minVotes);
    elements.swipeMinVotesCustomField.hidden = presetVotes !== "custom";
    elements.swipeMinScore.value = String(filters.minScore);
    elements.swipeMaxScore.value = String(filters.maxScore);
    elements.swipeExcludeChinese.checked = filters.excludeChinese;
    elements.swipeExcludeWeb.checked = filters.excludeWeb;
    elements.swipeExcludeMovie.checked = filters.excludeMovie;
    elements.swipeExcludeTheatrical.checked = filters.excludeTheatrical;
    elements.swipeExcludeCompilation.checked = filters.excludeCompilation;
    elements.swipeExcludeOther.checked = filters.excludeOther;
    updateSwipeFilterLabels();
  }

  function updateSwipeFilterLabels(changedControl) {
    let minScore = Number(elements.swipeMinScore.value);
    let maxScore = Number(elements.swipeMaxScore.value);
    if (minScore > maxScore) {
      if (changedControl === elements.swipeMinScore) maxScore = minScore;
      else minScore = maxScore;
      elements.swipeMinScore.value = String(minScore);
      elements.swipeMaxScore.value = String(maxScore);
    }
    elements.swipeStartYearValue.textContent = `${elements.swipeStartYear.value}年`;
    elements.swipeMinScoreValue.textContent = minScore <= 0 ? "不限" : `${minScore.toFixed(1)}分`;
    elements.swipeMaxScoreValue.textContent = maxScore >= 10 ? "不限" : `${maxScore.toFixed(1)}分`;
  }

  function applySwipeFilters() {
    state.swipeFilters = readSwipeFilters();
    saveSwipeFilters();
    state.swipeSessionCount = 0;
    prepareSwipeQueue(true);
    renderSwipeDeck();
    elements.swipeDeck.querySelector('[data-stack-index="0"]')?.focus();
    showToast(`已按新条件生成 ${state.swipeQueue.length.toLocaleString("zh-CN")} 部候选`);
  }

  function resetSwipeFilters() {
    state.swipeFilters = { ...SWIPE_DEFAULT_FILTERS };
    renderSwipeFilterControls();
    applySwipeFilters();
  }

  function swipeCandidates() {
    const filters = state.swipeFilters;
    const scoreRangeActive = filters.minScore > 0 || filters.maxScore < 10;
    return catalog.filter((item) => {
      const displayedType = item.origin === "cn" ? chineseCategory(item).key : item.type;
      if (selected.has(item.id) || swipeSkipped.has(item.id) || !isReleasedSwipeCandidate(item)) return false;
      if (!Number.isInteger(item.year) || item.year < filters.startYear || item.voteCount < filters.minVotes) return false;
      if (scoreRangeActive && (!Number.isFinite(item.score) || item.score < filters.minScore || item.score > filters.maxScore)) return false;
      if (filters.excludeChinese && item.origin === "cn") return false;
      if (filters.excludeWeb && item.type === "web") return false;
      if (filters.excludeMovie && ["movie", "cn-movie"].includes(displayedType)) return false;
      if (filters.excludeTheatrical && item.type === "theatrical") return false;
      if (filters.excludeCompilation && item.isCompilation) return false;
      if (filters.excludeOther && ["other", "cn-other"].includes(displayedType)) return false;
      return true;
    });
  }

  function shuffledSwipeIds(items) {
    const ids = items.map((item) => item.id);
    for (let index = ids.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
    }
    return ids;
  }

  function prepareSwipeQueue(force = false) {
    if (!force && state.swipeQueue.length) {
      state.swipeQueue = state.swipeQueue.filter((id) => catalogById.has(id) && !selected.has(id) && !swipeSkipped.has(id));
      if (state.swipeQueue.length) return;
    }
    state.swipeQueue = shuffledSwipeIds(swipeCandidates());
  }

  function renderSwipeDeck() {
    prepareSwipeQueue();
    const items = state.swipeQueue.slice(0, 4).map((id) => catalogById.get(id)).filter(Boolean);
    elements.swipeFilterSummary.textContent = `当前条件下剩余 ${state.swipeQueue.length.toLocaleString("zh-CN")} 部候选；修改条件后点击“重新开始”。`;
    elements.swipeActions.querySelectorAll("button").forEach((button) => { button.disabled = !items.length || state.swipeAnimating; });
    elements.undoSwipeDecision.disabled = !state.swipeHistory.length || state.swipeAnimating;
    if (!items.length) {
      elements.swipeDeck.innerHTML = `<div class="swipe-deck-empty"><span>✓</span><h4>这一轮已经刷完了</h4><p>可以让右滑过的作品重新出现，或者回到资料库精确查找。</p></div>`;
      return;
    }
    elements.swipeDeck.innerHTML = items.map((item, index) => {
      const poster = safeUrl(item.poster);
      const scoreText = Number.isFinite(item.score) && item.voteCount >= 30 ? `★ ${item.score.toFixed(1)}` : "评分样本较少";
      return `<article class="swipe-card${poster ? "" : " has-fallback"}" style="--stack-index:${index}" data-swipe-id="${escapeHtml(item.id)}" data-stack-index="${index}" data-swipe-year="${item.year || ""}" data-swipe-votes="${item.voteCount}" data-swipe-score="${Number.isFinite(item.score) ? item.score : ""}" data-swipe-origin="${escapeHtml(item.origin || "jp")}" data-swipe-type="${escapeHtml(item.type)}" data-swipe-compilation="${String(Boolean(item.isCompilation))}" ${index === 0 ? 'tabindex="0" role="group" aria-label="当前作品，可用方向键快速判断"' : 'aria-hidden="true"'}>
        <div class="swipe-card-poster">${poster ? `<img src="${escapeHtml(poster)}" alt="${escapeHtml(item.title)}海报" draggable="false" referrerpolicy="no-referrer" />` : ""}<b>${escapeHtml(item.title.slice(0, 1) || "番")}</b></div>
        <div class="swipe-card-copy"><span>${escapeHtml(catalogTypeLabel(item))} · ${escapeHtml(item.year ? `${item.year}年` : "日期待补")}</span><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.originalTitle || "原名待补")}</p><div class="swipe-card-metrics"><b>${escapeHtml(scoreText)}</b><small>${item.voteCount.toLocaleString("zh-CN")} 人评分</small></div></div>
        <div class="swipe-stamp swipe-stamp--watched">看过</div><div class="swipe-stamp swipe-stamp--unseen">没看过</div><div class="swipe-stamp swipe-stamp--recommend">推荐</div><div class="swipe-stamp swipe-stamp--worst">不推荐</div>
      </article>`;
    }).reverse().join("");
    elements.swipeDeck.querySelectorAll("img").forEach((image) => {
      const card = image.closest(".swipe-card");
      image.addEventListener("load", () => card?.classList.remove("has-fallback"), { once: true });
      image.addEventListener("error", () => card?.classList.add("has-fallback"), { once: true });
      window.setTimeout(() => {
        if (!image.complete || !image.naturalWidth) card?.classList.add("has-fallback");
      }, 900);
    });
  }

  function persistSwipeDecision(id, action) {
    const item = catalogById.get(id);
    if (!item) return;
    if (action === "unseen") {
      swipeSkipped.add(id);
      saveSwipeSkipped();
    } else {
      const reaction = action === "recommend" ? "recommended" : action === "worst" ? "difficult" : "watched";
      selected.set(id, { ...item, reaction, addedAt: new Date().toISOString() });
      swipeSkipped.delete(id);
      saveCollection();
    }
    state.swipeQueue = state.swipeQueue.filter((candidate) => candidate !== id);
    state.swipeSessionCount += 1;
    state.swipeHistory.push({ id, action });
  }

  function undoLastSwipeDecision() {
    if (state.swipeAnimating) return;
    const decision = state.swipeHistory.pop();
    if (!decision) return;
    const item = catalogById.get(decision.id);
    if (decision.action === "unseen") {
      swipeSkipped.delete(decision.id);
      saveSwipeSkipped();
    } else {
      selected.delete(decision.id);
      saveCollection();
    }
    state.swipeQueue = [decision.id, ...state.swipeQueue.filter((id) => id !== decision.id)];
    state.swipeSessionCount = Math.max(0, state.swipeSessionCount - 1);
    renderHeaderStats();
    renderDrawer();
    renderSwipeDeck();
    showToast(item ? `已撤回对《${item.title}》的上一步选择` : "已撤回上一步选择");
  }

  function applySwipeDecision(action) {
    if (state.swipeAnimating || !["watched", "unseen", "recommend", "worst"].includes(action)) return;
    const id = state.swipeQueue[0];
    const card = elements.swipeDeck.querySelector(`.swipe-card[data-swipe-id="${CSS.escape(id || "")}"]`);
    if (!id || !card) return;
    state.swipeAnimating = true;
    elements.swipeActions.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    elements.undoSwipeDecision.disabled = true;
    card.style.transform = "";
    card.removeAttribute("data-swipe-preview");
    card.classList.add("is-exiting", `is-exiting--${action}`);
    window.setTimeout(() => {
      persistSwipeDecision(id, action);
      state.swipeAnimating = false;
      renderHeaderStats();
      renderDrawer();
      renderSwipeDeck();
    }, 300);
  }

  function resetSwipeCardPosition(card) {
    if (!card) return;
    card.classList.remove("is-dragging");
    card.style.transform = "";
    card.removeAttribute("data-swipe-preview");
  }

  function swipeActionForDelta(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "watched" : "unseen";
    return dy < 0 ? "recommend" : "worst";
  }

  function handleSwipePointerDown(event) {
    if (state.swipeAnimating || (event.pointerType === "mouse" && event.button !== 0)) return;
    const card = event.target.closest('.swipe-card[data-stack-index="0"]');
    if (!card) return;
    event.preventDefault();
    card.setPointerCapture?.(event.pointerId);
    card.classList.add("is-dragging");
    swipePointer = { pointerId: event.pointerId, card, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0 };
  }

  function handleSwipePointerMove(event) {
    if (!swipePointer || swipePointer.pointerId !== event.pointerId) return;
    event.preventDefault();
    swipePointer.dx = event.clientX - swipePointer.startX;
    swipePointer.dy = event.clientY - swipePointer.startY;
    const { card, dx, dy } = swipePointer;
    const action = swipeActionForDelta(dx, dy);
    card.dataset.swipePreview = action;
    card.style.transform = `translate3d(calc(-50% + ${dx}px), ${dy}px, 0) rotate(${Math.max(-12, Math.min(12, dx / 22))}deg)`;
  }

  function finishSwipePointer(event, cancelled = false) {
    if (!swipePointer || swipePointer.pointerId !== event.pointerId) return;
    const { card, dx, dy } = swipePointer;
    swipePointer = null;
    card.releasePointerCapture?.(event.pointerId);
    const distance = Math.hypot(dx, dy);
    if (cancelled || distance < 72) {
      resetSwipeCardPosition(card);
      return;
    }
    applySwipeDecision(swipeActionForDelta(dx, dy));
  }

  function renderCollectionMode() {
    const galleryActive = state.collectionMode === "gallery";
    elements.collectionGallery.hidden = !galleryActive;
    elements.collectionTablePanel.hidden = galleryActive;
    elements.collectionModeButtons.forEach((button) => {
      const active = button.dataset.collectionMode === state.collectionMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderDecadeRow(period, items) {
    const television = items.filter((item) => item.type === "tv");
    return `
      <tr class="decade-row${items.length ? " has-records" : ""}">
        ${renderPeriodHeader(period, items.length)}
        ${renderHistoryCell(television, "TV动画 · 年代汇总", 4)}
        ${renderHistoryCell(items.filter((item) => item.type === "web"), "WEB动画")}
        ${renderHistoryCell(items.filter((item) => item.type === "movie"), "动画电影")}
        ${renderHistoryCell(items.filter((item) => item.type === "theatrical"), "剧场版")}
        ${renderHistoryCell(items.filter((item) => item.type === "other"), "其他")}
      </tr>`;
  }

  function renderYearRow(period, items) {
    return `
      <tr class="${items.length ? "has-records" : ""}">
        ${renderPeriodHeader(period, items.length)}
        ${["1", "4", "7", "10"].map((season) => renderHistoryCell(
          items.filter((item) => item.type === "tv" && item.season === season),
          `${season}月番`
        )).join("")}
        ${renderHistoryCell(items.filter((item) => item.type === "web"), "WEB动画")}
        ${renderHistoryCell(items.filter((item) => item.type === "movie"), "动画电影")}
        ${renderHistoryCell(items.filter((item) => item.type === "theatrical"), "剧场版")}
        ${renderHistoryCell(items.filter((item) => item.type === "other"), "其他")}
      </tr>`;
  }

  function renderPeriodHeader(period, count) {
    return `
      <th scope="row">
        <strong>${escapeHtml(period.label)}</strong>
        <small>${count ? `${count} 部` : "尚未记录"}</small>
      </th>`;
  }

  function renderHistoryCell(items, label, colspan = 1) {
    const sorted = Core.sortAnime(items, "date", "asc");
    return `
      <td${colspan > 1 ? ` colspan="${colspan}" class="decade-tv-cell"` : ""}>
        <span class="mobile-cell-label">${escapeHtml(label)}</span>
        <div class="history-cell-content">
          ${sorted.length ? sorted.map((item) => `
            <span
              class="history-entry reaction-${escapeHtml(item.reaction)}"
              data-theme-context-id="${escapeHtml(item.id)}"
            >
              <span class="reaction-title reaction-title--${escapeHtml(item.reaction)}">${titleLink(item, "anime-title-link history-title-link")}</span>
              <button type="button" data-remove-id="${escapeHtml(item.id)}" aria-label="移除${escapeHtml(item.title)}">×</button>
            </span>`).join("") : `<span class="cell-placeholder">留给下一部动画</span>`}
        </div>
      </td>`;
  }

  function fillManualYears() {
    elements.manualYear.innerHTML = Array.from({ length: currentYear - 1917 + 1 }, (_, index) => 1917 + index)
      .map((year) => `<option value="${year}">${year}年</option>`)
      .join("");
  }

  function openManualDialog() {
    const period = state.view === "collection" && state.collectionPeriod !== "all"
      ? Core.PERIODS.find((candidate) => candidate.key === state.collectionPeriod) || activePeriod()
      : activePeriod();
    elements.manualForm.reset();
    elements.manualYear.value = String(Math.max(1917, Number(period.start) || currentYear));
    elements.manualType.value = "tv";
    elements.manualSeason.value = "1";
    updateManualSeasonVisibility();
    elements.manualDialog.showModal();
    requestAnimationFrame(() => elements.manualForm.elements.title.focus());
  }

  function updateManualSeasonVisibility() {
    const showSeason = elements.manualType.value === "tv";
    elements.manualSeasonField.hidden = !showSeason;
    elements.manualSeason.disabled = !showSeason;
  }

  function addManualEntry(event) {
    event.preventDefault();
    const formData = new FormData(elements.manualForm);
    const title = String(formData.get("title") || "").trim();
    if (!title) return;
    const type = String(formData.get("type"));
    const id = typeof crypto.randomUUID === "function"
      ? `manual-${crypto.randomUUID()}`
      : `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const entry = Core.normalizeAnime({
      id,
      title,
      originalTitle: formData.get("originalTitle"),
      year: formData.get("year"),
      type,
      season: type === "tv" ? formData.get("season") : null,
      poster: formData.get("poster"),
      note: formData.get("note"),
      reaction: formData.get("reaction"),
      custom: true,
      addedAt: new Date().toISOString(),
    });
    selected.set(entry.id, entry);
    saveCollection();
    elements.manualDialog.close();
    renderAll();
    showToast(`已手动收录《${entry.title}》`);
  }

  function exportCollection() {
    const payload = {
      format: "anime-atlas-collection",
      version: 3,
      exportedAt: new Date().toISOString(),
      records: [...selected.values()],
      themeLists: themeLists.map(({ id, syncCareer, records }) => ({ id, syncCareer, records })),
      swipeSkipped: [...swipeSkipped],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${Core.safeFileName("番迹-我的动画生涯表")}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    showToast(`已导出 ${selected.size} 条记录`);
  }

  async function importCollection(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const records = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(records)) throw new Error("文件中没有 records 数组");
      let imported = 0;
      records.forEach((item, index) => {
        const normalized = normalizeCollectionItem(item, index);
        if (!isCurrentOrPastYear(normalized)) return;
        if (["recommended", "difficult"].includes(normalized.reaction)) {
          const target = themeLists.find((list) => list.id === (normalized.reaction === "recommended" ? "recommend" : "worst"));
          if (target && !target.records.some((record) => record.id === normalized.id)) target.records.push({ id: normalized.id, note: "", bucketYear: null, addedAt: normalized.addedAt });
        }
        selected.set(normalized.id, normalized);
        swipeSkipped.delete(normalized.id);
        imported += 1;
      });
      if (Array.isArray(parsed.themeLists)) {
        parsed.themeLists.forEach((incoming) => {
          const list = themeLists.find((candidate) => candidate.id === incoming.id);
          if (!list || !Array.isArray(incoming.records)) return;
          if (typeof incoming.syncCareer === "boolean") list.syncCareer = incoming.syncCareer;
          incoming.records.forEach((record) => {
            const normalized = typeof record === "string" ? { id: record } : record;
            if (!normalized?.id || !catalogById.has(normalized.id)) return;
            const year = Number(normalized.bucketYear) || null;
            if (list.records.some((current) => current.id === normalized.id && current.bucketYear === year)) return;
            list.records.push({ id: normalized.id, note: String(normalized.note || "").slice(0, 120), bucketYear: year, addedAt: normalized.addedAt || null });
          });
        });
      }
      if (Array.isArray(parsed.swipeSkipped)) {
        parsed.swipeSkipped.forEach((id) => {
          if (typeof id === "string" && catalogById.has(id) && !selected.has(id)) swipeSkipped.add(id);
        });
      }
      saveSwipeSkipped();
      saveCollection();
      saveThemeLists();
      renderAll();
      showToast(`成功导入 ${imported} 条记录`);
    } catch (error) {
      console.error(error);
      showToast("导入失败：请选择由本站导出的 JSON 文件", "error");
    } finally {
      elements.importInput.value = "";
    }
  }

  function removeSelected(id) {
    const item = selected.get(id);
    if (!item) return;
    selected.delete(id);
    saveCollection();
    renderAll();
    showToast(`已移除《${item.title}》`);
  }

  function themeDropTargetAt(clientX, clientY) {
    const target = document.elementsFromPoint(clientX, clientY)
      .map((element) => element.closest("[data-theme-id]"))
      .find(Boolean);
    elements.themeMatrix.querySelectorAll(".is-drop-target").forEach((card) => card.classList.remove("is-drop-target"));
    if (target && target.dataset.themeId !== themeDraggedId) target.classList.add("is-drop-target");
    return target || null;
  }

  function clearThemeDragStyles() {
    elements.themeMatrix.querySelectorAll(".is-dragging, .is-drop-target").forEach((card) => {
      card.classList.remove("is-dragging", "is-drop-target");
    });
    document.querySelector(".theme-drag-ghost")?.remove();
    document.body.classList.remove("theme-drag-active");
    themeDraggedId = null;
    if (themeTouchDrag?.timer) window.clearTimeout(themeTouchDrag.timer);
    themeTouchDrag = null;
  }

  function attachThemeReorderEvents() {
    elements.themeMatrix.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button, a")) return;
      const card = event.target.closest("[data-theme-id]");
      if (!card) return;
      const drag = {
        id: card.dataset.themeId,
        card,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        active: false,
        ghost: null,
        timer: null,
        activate: null,
      };
      drag.activate = () => {
        if (themeTouchDrag !== drag) return;
        drag.active = true;
        themeDraggedId = drag.id;
        drag.card.classList.add("is-dragging");
        document.body.classList.add("theme-drag-active");
        const rect = drag.card.getBoundingClientRect();
        const ghost = drag.card.cloneNode(true);
        ghost.className = "theme-matrix-card theme-single-card theme-drag-ghost";
        ghost.removeAttribute("tabindex");
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.left = `${drag.clientX + 12}px`;
        ghost.style.top = `${drag.clientY + 12}px`;
        document.body.append(ghost);
        drag.ghost = ghost;
        if (["touch", "pen"].includes(drag.pointerType)) navigator.vibrate?.(24);
      };
      if (["touch", "pen"].includes(event.pointerType)) drag.timer = window.setTimeout(drag.activate, 460);
      themeTouchDrag = drag;
      try { card.setPointerCapture(event.pointerId); } catch {}
    });
    elements.themeMatrix.addEventListener("pointermove", (event) => {
      const drag = themeTouchDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.clientX = event.clientX;
      drag.clientY = event.clientY;
      if (!drag.active) {
        const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (["touch", "pen"].includes(drag.pointerType)) {
          if (distance > 9) clearThemeDragStyles();
          return;
        }
        if (distance <= 4) return;
        drag.activate();
        if (!drag.active) return;
      }
      event.preventDefault();
      drag.ghost.style.left = `${event.clientX + 12}px`;
      drag.ghost.style.top = `${event.clientY + 12}px`;
      themeDropTargetAt(event.clientX, event.clientY);
    }, { passive: false });
    const finishThemeDrag = (event) => {
      const drag = themeTouchDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const target = drag.active ? themeDropTargetAt(event.clientX, event.clientY) : null;
      const draggedId = drag.id;
      const targetId = target?.dataset.themeId;
      const active = drag.active;
      clearThemeDragStyles();
      if (active && targetId && targetId !== draggedId) {
        themeSuppressClick = true;
        moveThemeList(draggedId, targetId);
        window.setTimeout(() => { themeSuppressClick = false; }, 0);
      }
    };
    elements.themeMatrix.addEventListener("pointerup", finishThemeDrag);
    elements.themeMatrix.addEventListener("pointercancel", clearThemeDragStyles);
    elements.themeMatrix.addEventListener("contextmenu", (event) => {
      if (themeTouchDrag?.active) event.preventDefault();
    });
  }

  function annualDropTargetAt(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY)?.closest("[data-annual-record-id]");
    elements.annualSelectedGrid.querySelectorAll(".is-drop-target").forEach((card) => card.classList.remove("is-drop-target"));
    if (target && target.dataset.annualRecordId !== annualDraggedId) target.classList.add("is-drop-target");
    return target || null;
  }

  function attachAnnualReorderEvents() {
    elements.annualSelectedGrid.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button, a")) return;
      const card = event.target.closest("[data-annual-record-id]");
      if (!card) return;
      const drag = {
        id: card.dataset.annualRecordId,
        card,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        active: false,
        ghost: null,
        timer: null,
        activate: null,
      };
      drag.activate = () => {
        if (annualTouchDrag !== drag) return;
        drag.active = true;
        annualDraggedId = drag.id;
        drag.card.classList.add("is-dragging");
        document.body.classList.add("annual-drag-active");
        const rect = drag.card.getBoundingClientRect();
        const ghost = drag.card.cloneNode(true);
        ghost.className = "annual-selected-card annual-drag-ghost";
        ghost.removeAttribute("draggable");
        ghost.removeAttribute("tabindex");
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.left = `${drag.clientX + 12}px`;
        ghost.style.top = `${drag.clientY + 12}px`;
        document.body.append(ghost);
        drag.ghost = ghost;
        if (['touch', 'pen'].includes(event.pointerType) && navigator.vibrate) navigator.vibrate(24);
      };
      if (['touch', 'pen'].includes(event.pointerType)) drag.timer = window.setTimeout(drag.activate, 460);
      annualTouchDrag = drag;
      try { card.setPointerCapture(event.pointerId); } catch {}
    });
    elements.annualSelectedGrid.addEventListener("pointermove", (event) => {
      const drag = annualTouchDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.clientX = event.clientX;
      drag.clientY = event.clientY;
      if (!drag.active) {
        const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (['touch', 'pen'].includes(event.pointerType)) {
          if (distance > 9) clearAnnualDragStyles();
          return;
        }
        if (distance <= 4) return;
        drag.activate();
        if (!drag.active) return;
      }
      event.preventDefault();
      drag.ghost.style.left = `${event.clientX + 12}px`;
      drag.ghost.style.top = `${event.clientY + 12}px`;
      annualDropTargetAt(event.clientX, event.clientY);
    }, { passive: false });
    const finishTouchDrag = (event) => {
      const drag = annualTouchDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const target = drag.active ? annualDropTargetAt(event.clientX, event.clientY) : null;
      const draggedId = drag.id;
      const targetId = target?.dataset.annualRecordId;
      const active = drag.active;
      clearAnnualDragStyles();
      if (active) moveAnnualRecord(draggedId, targetId);
    };
    elements.annualSelectedGrid.addEventListener("pointerup", finishTouchDrag);
    elements.annualSelectedGrid.addEventListener("pointercancel", clearAnnualDragStyles);
    elements.annualSelectedGrid.addEventListener("contextmenu", (event) => {
      if (annualTouchDrag?.active) event.preventDefault();
    });
  }

  function attachEvents() {
    attachAnnualReorderEvents();
    attachThemeReorderEvents();
    document.querySelectorAll("[data-start-path]").forEach((button) => button.addEventListener("click", () => {
      showView(button.dataset.startPath);
    }));

    elements.navButtons.forEach((button) => {
      button.addEventListener("click", () => showView(button.dataset.view));
    });
    elements.homeBrand.addEventListener("click", (event) => {
      event.preventDefault();
      showView("swipe");
    });

    elements.originSwitch.addEventListener("click", (event) => {
      const button = event.target.closest("[data-origin]");
      if (!button || button.dataset.origin === state.origin) return;
      state.originPeriods[state.origin] = state.period;
      state.originFoldSettings[state.origin] = {
        lowVotes: state.collapseLowVotes,
        compilations: state.collapseCompilations,
      };
      state.origin = button.dataset.origin;
      state.period = state.originPeriods[state.origin];
      state.collapseLowVotes = state.originFoldSettings[state.origin].lowVotes;
      state.collapseCompilations = state.originFoldSettings[state.origin].compilations;
      state.type = "all";
      state.season = "all";
      state.query = "";
      state.catalogLimit = 240;
      renderAll({ scrollTimeline: true });
    });

    elements.timeline.addEventListener("click", (event) => {
      const button = event.target.closest("[data-period]");
      if (!button) return;
      if (state.view === "collection") {
        state.collectionPeriod = button.dataset.period;
        state.collectionType = "all";
        state.collectionSeason = "all";
        renderTimeline(true);
        renderCollection();
        elements.collectionGrouping.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      state.period = button.dataset.period;
      state.originPeriods[state.origin] = state.period;
      state.catalogLimit = 240;
      state.season = "all";
      state.type = "all";
      state.query = "";
      renderAll({ scrollTimeline: true });
    });

    elements.catalogModeFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-catalog-mode]");
      if (!button || button.dataset.catalogMode === state.catalogMode) return;
      const anchor = captureBrowseAnchor();
      state.catalogMode = button.dataset.catalogMode;
      renderFilters();
      renderCatalog(anchor);
    });

    elements.timelinePrev.addEventListener("click", () => elements.timeline.scrollBy({ left: -520, behavior: "smooth" }));
    elements.timelineNext.addEventListener("click", () => elements.timeline.scrollBy({ left: 520, behavior: "smooth" }));
    const jumpToTimelineYear = () => {
      const year = Number(elements.timelineYearInput.value);
      if (!Number.isInteger(year) || year < 1917 || year > currentYear) return showToast(`请输入 1917—${currentYear} 之间的年份`, "error");
      if (state.view !== "collection" && state.origin === "cn" && year > currentYear) return showToast("国产资料库暂不展示尚未到来的年份", "error");
      const period = state.view !== "collection" && state.origin === "cn" && year >= 1990 && year <= 1999
        ? "1990s"
        : Core.periodForYear(year);
      if (state.view === "collection") {
        state.collectionPeriod = period;
        state.collectionType = "all";
        state.collectionSeason = "all";
        renderTimeline(true);
        renderCollection();
      } else {
        state.period = period;
        state.originPeriods[state.origin] = period;
        state.query = "";
        state.type = "all";
        state.season = "all";
        state.catalogLimit = 240;
        renderAll({ scrollTimeline: true });
      }
    };
    elements.timelineYearJump.addEventListener("click", jumpToTimelineYear);
    elements.timelineYearInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") jumpToTimelineYear();
    });

    elements.seasonFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-season]");
      if (!button) return;
      state.season = button.dataset.season;
      state.catalogLimit = 240;
      if (state.season !== "all") state.type = "tv";
      renderFilters();
      renderCatalog();
    });

    elements.typeFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-type]");
      if (!button) return;
      state.type = button.dataset.type;
      state.catalogLimit = 240;
      if (state.type !== "tv") state.season = "all";
      renderFilters();
      renderCatalog();
    });

    elements.searchInput.addEventListener("input", () => {
      state.query = elements.searchInput.value;
      state.catalogLimit = 240;
      renderCatalog();
    });
    elements.mobileFilterToggle.addEventListener("click", () => {
      state.mobileFiltersExpanded = !state.mobileFiltersExpanded;
      elements.mobileFilterToggle.closest(".filter-panel").classList.toggle("is-expanded", state.mobileFiltersExpanded);
      elements.mobileFilterToggle.setAttribute("aria-expanded", String(state.mobileFiltersExpanded));
      elements.mobileFilterToggle.querySelector("strong").textContent = state.mobileFiltersExpanded ? "收起" : "展开";
    });
    elements.sortSelect.addEventListener("change", () => {
      state.sort = elements.sortSelect.value;
      state.catalogLimit = 240;
      renderCatalog();
    });
    elements.sortDirection.addEventListener("change", () => {
      state.sortDirection = elements.sortDirection.value;
      state.catalogLimit = 240;
      renderCatalog();
    });
    elements.lowVoteToggle.addEventListener("change", () => {
      state.collapseLowVotes = elements.lowVoteToggle.checked;
      state.originFoldSettings[state.origin].lowVotes = state.collapseLowVotes;
      renderCatalog();
    });
    elements.compilationToggle.addEventListener("change", () => {
      state.collapseCompilations = elements.compilationToggle.checked;
      state.originFoldSettings[state.origin].compilations = state.collapseCompilations;
      renderCatalog();
    });
    elements.clearFilters.addEventListener("click", () => {
      state.season = "all";
      state.type = "all";
      state.query = "";
      state.catalogLimit = 240;
      state.sort = "votes";
      state.sortDirection = "desc";
      renderFilters();
      renderCatalog();
    });

    elements.catalogLoadMore.addEventListener("click", () => {
      const anchor = captureBrowseAnchor();
      state.catalogLimit += 240;
      renderCatalog(anchor);
    });

    document.addEventListener("contextmenu", (event) => {
      const target = event.target.closest("[data-theme-context-id]");
      if (!target) return closeThemeQuickMenu();
      event.preventDefault();
      openThemeQuickMenu(target.dataset.themeContextId, event.clientX, event.clientY);
    });
    let longPress = null;
    const cancelLongPress = () => {
      if (longPress?.timer) window.clearTimeout(longPress.timer);
      longPress = null;
    };
    document.addEventListener("pointerdown", (event) => {
      const target = event.target.closest("[data-theme-context-id]");
      if (!target || event.pointerType === "mouse") return;
      cancelLongPress();
      longPress = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        timer: window.setTimeout(() => {
          openThemeQuickMenu(target.dataset.themeContextId, event.clientX, event.clientY);
          navigator.vibrate?.(18);
          longPress = null;
        }, 520),
      };
    }, { passive: true });
    document.addEventListener("pointermove", (event) => {
      if (!longPress || longPress.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - longPress.x, event.clientY - longPress.y) > 12) cancelLongPress();
    }, { passive: true });
    document.addEventListener("pointerup", cancelLongPress, { passive: true });
    document.addEventListener("pointercancel", cancelLongPress, { passive: true });
    elements.themeQuickMenu.addEventListener("click", (event) => {
      const reactionButton = event.target.closest("[data-quick-reaction]");
      if (reactionButton && quickMenuItemId) {
        setCollectionReaction(quickMenuItemId, reactionButton.dataset.quickReaction);
        closeThemeQuickMenu();
        return;
      }
      const button = event.target.closest("[data-quick-theme]");
      if (!button || !quickMenuItemId) return;
      const list = themeLists.find((candidate) => candidate.id === button.dataset.quickTheme);
      const item = catalogById.get(quickMenuItemId) || selected.get(quickMenuItemId);
      if (!list || !item) return;
      toggleThemeRecord(list, item.id, list.annual ? item.year : state.themeYear, { compactToast: true });
      closeThemeQuickMenu();
    });

    elements.openSelection.addEventListener("click", () => {
      toggleMobileNav();
    });
    elements.selectionDrawer.addEventListener("click", (event) => {
      if (event.target.closest('[data-action="close-drawer"]')) closeDrawer();
      if (event.target.closest('[data-action="show-collection"]')) showView("collection");
      const remove = event.target.closest("[data-remove-id]");
      if (remove) removeSelected(remove.dataset.removeId);
    });

    document.addEventListener("click", (event) => {
      if (document.body.classList.contains("mobile-nav-open") && !event.target.closest(".site-header")) {
        setMobileNavOpen(false);
      }
      const collectionSection = event.target.closest("[data-collection-section]");
      if (collectionSection) {
        document.querySelector(`#${CSS.escape(collectionSection.dataset.collectionSection)}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (!event.target.closest("#themeQuickMenu")) closeThemeQuickMenu();
      if (event.target.closest('[data-action="quick-backup"]')) exportCollection();
      if (event.target.closest('[data-action="manual-add"]')) openManualDialog();
      if (event.target.closest('[data-action="close-manual"]')) elements.manualDialog.close();
      if (event.target.closest('[data-action="close-custom-theme"]')) elements.customThemeDialog.close();
    });
    elements.openManualAdd.addEventListener("click", openManualDialog);
    elements.manualType.addEventListener("change", updateManualSeasonVisibility);
    elements.manualForm.addEventListener("submit", addManualEntry);

    elements.historyTableBody.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove-id]");
      if (remove) removeSelected(remove.dataset.removeId);
    });

    elements.collectionGallery.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove-id]");
      if (remove) removeSelected(remove.dataset.removeId);
    });
    elements.swipeActions.addEventListener("click", (event) => {
      const button = event.target.closest("[data-swipe-action]");
      if (button) applySwipeDecision(button.dataset.swipeAction);
    });
    elements.swipeDeck.addEventListener("pointerdown", handleSwipePointerDown);
    elements.swipeDeck.addEventListener("pointermove", handleSwipePointerMove);
    elements.swipeDeck.addEventListener("pointerup", (event) => finishSwipePointer(event));
    elements.swipeDeck.addEventListener("pointercancel", (event) => finishSwipePointer(event, true));
    elements.swipeDeck.addEventListener("keydown", (event) => {
      const action = { ArrowLeft: "watched", ArrowRight: "unseen", ArrowUp: "recommend", ArrowDown: "worst" }[event.key];
      if (!action || !event.target.closest('.swipe-card[data-stack-index="0"]')) return;
      event.preventDefault();
      applySwipeDecision(action);
    });
    elements.undoSwipeDecision.addEventListener("click", undoLastSwipeDecision);
    elements.resetSwipeSkipped.addEventListener("click", () => {
      if (!swipeSkipped.size) return showToast("目前没有右滑标记为没看过的作品");
      if (!window.confirm(`让 ${swipeSkipped.size} 部“没看过”的作品重新进入随机候选池吗？`)) return;
      swipeSkipped.clear();
      saveSwipeSkipped();
      prepareSwipeQueue(true);
      renderSwipeDeck();
      showToast("“没看过”的作品已重新加入候选池");
    });
    [elements.swipeStartYear, elements.swipeMinScore, elements.swipeMaxScore]
      .forEach((control) => control.addEventListener("input", () => updateSwipeFilterLabels(control)));
    elements.swipeMinVotesPreset.addEventListener("change", () => {
      const isCustom = elements.swipeMinVotesPreset.value === "custom";
      elements.swipeMinVotesCustomField.hidden = !isCustom;
      if (isCustom) elements.swipeMinVotesCustom.focus();
    });
    elements.swipeMinVotesCustom.addEventListener("change", () => {
      const value = Math.round(Math.min(1000000, Math.max(0, Number(elements.swipeMinVotesCustom.value) || 0)));
      elements.swipeMinVotesCustom.value = String(value);
    });
    elements.applySwipeFilters.addEventListener("click", applySwipeFilters);
    elements.resetSwipeFilters.addEventListener("click", resetSwipeFilters);
    elements.collectionModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.collectionMode = button.dataset.collectionMode;
        renderCollection();
      });
    });
    elements.collectionTypeFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-collection-type]");
      if (!button) return;
      state.collectionType = button.dataset.collectionType;
      if (state.collectionType !== "tv") state.collectionSeason = "all";
      renderCollection();
    });
    elements.collectionSeasonFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-collection-season]");
      if (!button) return;
      state.collectionSeason = button.dataset.collectionSeason;
      if (state.collectionSeason !== "all") state.collectionType = "tv";
      renderCollection();
    });
    elements.clearCollectionFilters.addEventListener("click", () => {
      state.collectionPeriod = "all";
      state.collectionType = "all";
      state.collectionSeason = "all";
      renderTimeline(true);
      renderCollection();
    });
    elements.collectionInsights.addEventListener("click", (event) => {
      const point = event.target.closest("[data-chart-year]");
      if (!point) return;
      const year = Number(point.dataset.chartYear);
      state.collectionPeriod = Core.periodForYear(year);
      state.collectionType = "all";
      state.collectionSeason = "all";
      renderCollection();
      elements.collectionGrouping.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.collectionInsights.addEventListener("change", (event) => {
      if (!event.target.matches("#collectionRecentYearsToggle")) return;
      state.collectionRecentTenYears = event.target.checked;
      renderCollection();
    });
    elements.collectionInsights.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      const point = event.target.closest("[data-chart-year]");
      if (!point) return;
      event.preventDefault();
      point.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    elements.themeMatrix.addEventListener("click", (event) => {
      if (themeSuppressClick) {
        event.preventDefault();
        event.stopPropagation();
        themeSuppressClick = false;
        return;
      }
      const deleteButton = event.target.closest("[data-theme-delete]");
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        deleteThemeList(deleteButton.dataset.themeDelete);
        return;
      }
      const card = event.target.closest("[data-theme-id]");
      if (!card) return;
      selectTheme(card.dataset.themeId, true);
    });
    elements.themeMatrix.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key) || event.target.closest("[data-theme-delete]")) return;
      const card = event.target.closest("[data-theme-id]");
      if (!card) return;
      event.preventDefault();
      selectTheme(card.dataset.themeId, true);
    });
    elements.openCustomTheme.addEventListener("click", () => {
      elements.customThemeForm.reset();
      elements.customThemeDialog.showModal();
    });
    elements.clearThemes.addEventListener("click", () => openClearConfirmation("themes"));
    elements.customThemeForm.addEventListener("submit", addCustomTheme);

    elements.openShareStudio.addEventListener("click", openShareStudio);
    elements.closeShareDialog.addEventListener("click", () => elements.shareDialog.close());
    elements.generateShareImages.addEventListener("click", generateShareImageExports);
    elements.sharePreviewList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-download-share]");
      if (button) downloadShareExport(shareExports[Number(button.dataset.downloadShare)]);
      const shareButton = event.target.closest("[data-native-share]");
      if (shareButton) nativeShareExport(shareExports[Number(shareButton.dataset.nativeShare)]);
    });
    elements.downloadShareImages.addEventListener("click", () => {
      shareExports.forEach((item, index) => window.setTimeout(() => downloadShareExport(item), index * 180));
      showToast(`开始下载 ${shareExports.length} 张分享图`);
    });
    elements.browseForTheme.addEventListener("click", () => {
      showView("browse");
      showToast("右键作品；手机长按作品，即可选择要加入的喜好主题");
    });
    elements.themeCareerSync.addEventListener("change", () => {
      const list = activeThemeList();
      list.syncCareer = elements.themeCareerSync.checked;
      saveThemeLists();
    });
    elements.annualOriginFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-annual-origin]");
      if (!button) return;
      state.annualOrigin = button.dataset.annualOrigin;
      state.annualType = "all";
      state.annualSeason = "all";
      state.annualLimit = 160;
      renderAnnualView();
    });
    elements.annualTypeFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-annual-type]");
      if (!button) return;
      state.annualType = button.dataset.annualType;
      if (state.annualType !== "tv") state.annualSeason = "all";
      state.annualLimit = 160;
      renderAnnualView();
    });
    elements.annualSeasonFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-annual-season]");
      if (!button) return;
      state.annualSeason = button.dataset.annualSeason;
      state.annualType = "tv";
      state.annualLimit = 160;
      renderAnnualView();
    });
    elements.annualPageYear.addEventListener("change", () => {
      state.themeYear = Number(elements.annualPageYear.value);
      state.annualQuery = "";
      state.annualLimit = 160;
      elements.annualSearchInput.value = "";
      renderAnnualView();
    });
    elements.annualSearchInput.addEventListener("input", () => {
      state.annualQuery = elements.annualSearchInput.value;
      state.annualLimit = 160;
      renderAnnualView();
    });
    elements.annualSortSelect.addEventListener("change", () => {
      state.annualSort = elements.annualSortSelect.value;
      state.annualLimit = 160;
      renderAnnualView();
    });
    elements.annualSortDirection.addEventListener("change", () => {
      state.annualSortDirection = elements.annualSortDirection.value;
      state.annualLimit = 160;
      renderAnnualView();
    });
    elements.annualLoadMore.addEventListener("click", () => {
      state.annualLimit += 160;
      renderAnnualView();
    });
    elements.exportAnnualImage.addEventListener("click", openAnnualShareStudio);
    elements.clearAnnualYear.addEventListener("click", () => openClearConfirmation("annual"));
    elements.annualCareerSync.addEventListener("change", () => {
      const list = annualThemeList();
      if (!list) return;
      list.syncCareer = elements.annualCareerSync.checked;
      saveThemeLists();
    });
    [elements.annualSelectedGrid, elements.annualCatalogGrid].forEach((container) => {
      container.addEventListener("click", (event) => {
        const button = event.target.closest("[data-annual-toggle]");
        if (button) toggleThemeRecord(annualThemeList(), button.dataset.annualToggle, state.themeYear);
      });
    });
    elements.themeSearchInput.addEventListener("input", () => {
      state.themeQuery = elements.themeSearchInput.value;
      renderThemeSearchResults();
    });
    elements.themeSearchResults.addEventListener("click", (event) => {
      const button = event.target.closest("[data-theme-toggle]");
      if (button) toggleThemeRecord(activeThemeList(), button.dataset.themeToggle);
    });
    elements.themeGallery.addEventListener("click", (event) => {
      const button = event.target.closest("[data-theme-remove]");
      if (button) toggleThemeRecord(activeThemeList(), button.dataset.themeRemove);
    });
    elements.themeGallery.addEventListener("change", (event) => {
      const input = event.target.closest("[data-theme-note]");
      if (!input) return;
      const record = themeRecord(activeThemeList(), input.dataset.themeNote);
      if (!record) return;
      record.note = input.value.trim().slice(0, 120);
      saveThemeLists();
      showToast("备注已保存");
    });

    elements.exportButton.addEventListener("click", exportCollection);
    elements.importButton.addEventListener("click", () => elements.importInput.click());
    elements.importInput.addEventListener("change", () => importCollection(elements.importInput.files[0]));
    elements.clearCollection.addEventListener("click", () => openClearConfirmation("collection"));
    elements.closeConfirmClear.addEventListener("click", closeClearConfirmation);
    elements.cancelClearAction.addEventListener("click", closeClearConfirmation);
    elements.confirmClearAction.addEventListener("click", confirmClear);
    elements.confirmClearDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeClearConfirmation();
    });

    const updateBackToTop = () => {
      elements.backToTop.classList.toggle("is-visible", window.scrollY > 640);
    };
    window.addEventListener("scroll", () => {
      updateBackToTop();
      updateFloatingCatalogMode();
    }, { passive: true });
    elements.backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    updateBackToTop();
    updateFloatingCatalogMode();

    document.addEventListener("keydown", (event) => {
      if ((event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) && event.target.closest("[data-theme-context-id]")) {
        event.preventDefault();
        const target = event.target.closest("[data-theme-context-id]");
        const rect = target.getBoundingClientRect();
        openThemeQuickMenu(target.dataset.themeContextId, rect.left + Math.min(rect.width, 180), rect.top + 24);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (state.view === "themes") {
          elements.themeSearchInput.focus();
          return;
        }
        if (state.view === "annual") {
          elements.annualSearchInput.focus();
          return;
        }
        if (state.view !== "browse") showView("browse");
        elements.searchInput.focus();
      }
      if (event.key === "Escape") {
        closeThemeQuickMenu();
        closeDrawer();
        setMobileNavOpen(false);
      }
    });
  }

  fillManualYears();
  saveCollection();
  saveThemeLists();
  attachEvents();
  const compactSwipeFilter = window.matchMedia("(max-width: 640px)");
  elements.swipeFilterPanel.open = !compactSwipeFilter.matches;
  compactSwipeFilter.addEventListener?.("change", (event) => {
    elements.swipeFilterPanel.open = !event.matches;
  });
  renderAll({ scrollTimeline: true });
  showView("swipe");

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", async () => {
      const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing || !hadController) return;
        refreshing = true;
        location.reload();
      });
      try {
        const registration = await navigator.serviceWorker.register("service-worker.js");
        await registration.update();
      } catch (error) {
        console.warn("离线缓存更新失败", error);
      }
    });
  }
})();
