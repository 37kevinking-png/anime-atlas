const SHELL_CACHE = "anime-atlas-shell-v45";
const DATA_CACHE = "anime-atlas-data-v1";
const CACHE_PREFIX = "anime-atlas-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=45",
  "./core.js?v=45",
  "./app.js?v=45",
  "./assets/icon.svg",
  "./manifest.webmanifest",
];

const isDataRequest = (url) => (
  url.pathname.endsWith("/data/anime-data.js")
  || url.pathname.endsWith("/data/anime-cn-data.js")
);

const fetchFresh = (request, cacheMode = "no-cache") => (
  fetch(new Request(request, { cache: cacheMode }))
);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE && name !== DATA_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  if (isDataRequest(url)) {
    const cachePromise = caches.open(DATA_CACHE);
    const networkRequest = cachePromise.then(async (cache) => {
      const response = await fetchFresh(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    });

    event.waitUntil(networkRequest.catch(() => undefined));
    event.respondWith(cachePromise.then(async (cache) => (
      (await cache.match(event.request)) || networkRequest
    )));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const response = await fetchFresh(
        event.request,
        event.request.mode === "navigate" ? "no-store" : "no-cache"
      );
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
