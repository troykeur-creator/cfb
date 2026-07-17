/* CFB Fan App service worker — deploy this file NEXT TO index.html (same folder).
   Strategy:
   - App shell ("./" = index.html): network-first on navigation, cached fallback,
     so updates arrive when online and the app still opens instantly offline.
   - Google Fonts: cache-first (typography works offline).
   - Data APIs (ESPN, relays, Wikipedia, Open-Meteo, Anthropic): NEVER cached here.
     The app does its own data caching; service-worker-caching JSON turns into
     stale-data bugs.
   Updating: any new index.html reaches users automatically (network-first).
   Only bump CACHE below when this sw.js file itself changes. */
const CACHE = "cfb-shell-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["./"])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("cfb-shell-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // 1) App navigations: network-first, offline falls back to the cached shell
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("./", copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match("./"))
    );
    return;
  }

  // 2) Fonts: cache-first
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.host)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
      )
    );
    return;
  }

  // 3) Everything else (data APIs): straight to network — no SW caching on purpose.
});
