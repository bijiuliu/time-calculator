const CACHE_PREFIX = "time-calculator-";
const SCOPE_URL = new URL(self.registration.scope);
const CACHE_NAME = `${CACHE_PREFIX}${SCOPE_URL.pathname}-v2.0.63-network-first`;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./css/typography.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./assets/icons/favicon-32.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-192-dark.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-1024.png",
  "./assets/icons/apple-touch-icon.png"
].map(path => new URL(path, SCOPE_URL).href);
const CORE_URLS = new Set(CORE_ASSETS);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Revalidate HTTP cache as well as replacing the old service-worker cache.
    await cache.addAll(CORE_ASSETS.map(url => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME && (
      key.startsWith(`${CACHE_PREFIX}${SCOPE_URL.pathname}-`) ||
      // Migrate the previous, unscoped time-calculator version names only.
      /^time-calculator-\d+\./.test(key)
    )).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== SCOPE_URL.origin ||
      !url.pathname.startsWith(SCOPE_URL.pathname)) return;

  const responsePromise = (async () => {
    try {
      // Check the network on every visit, even if the cache version is unchanged.
      const response = await fetch(request, { cache: "no-cache" });
      if (response.ok && !response.redirected && CORE_URLS.has(url.href)) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        } catch {
          // Storage failures must not prevent an otherwise successful request.
        }
      }
      return response;
    } catch {
      try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        // Only the app's entry navigation may fall back to the offline HTML.
        if (request.mode === "navigate" &&
            [SCOPE_URL.pathname, `${SCOPE_URL.pathname}index.html`].includes(url.pathname)) {
          const page = await cache.match(new URL("index.html", SCOPE_URL).href);
          if (page) return page;
        }
      } catch {
        // Offline and storage unavailable: return a network error, never HTML for an asset.
      }
      return Response.error();
    }
  })();
  event.respondWith(responsePromise);
  event.waitUntil(responsePromise.then(() => undefined));
});
