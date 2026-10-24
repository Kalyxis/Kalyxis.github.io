/* Kalyxis service worker (generated at build time from scripts/sw.template.js).
 *  - Built files are precached, so every language and tool works offline after one visit.
 *  - Page navigations: network first (a new deploy shows up immediately), cached copy when offline.
 *  - Pyodide (Python runtime on jsDelivr, versioned and immutable): cache first.
 * Scope relative, so it works at the domain root and under any sub path. */
const BUILD = '__BUILD__';
const SHELL = `kalyxis-shell-${BUILD}`;
const RUNTIME = 'kalyxis-runtime-v1';
const scope = self.registration.scope;
const FILES = __PRECACHE__;
const EXTRA = ['manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then(async (cache) => {
      const urls = [scope, ...FILES, ...EXTRA].map((f) => new URL(f, scope).href);
      await Promise.all(urls.map((u) => cache.add(u).catch(() => undefined)));
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isPyodide = (url) => url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/pyodide/');

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(scope)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isPyodide(url)) { event.respondWith(cacheFirst(request, RUNTIME)); return; }
  if (url.origin !== location.origin) return;
  if (request.mode === 'navigate') { event.respondWith(networkFirst(request)); return; }
  if (url.pathname.includes('/assets/')) { event.respondWith(cacheFirst(request, SHELL)); return; }
  event.respondWith(networkFirst(request));
});
