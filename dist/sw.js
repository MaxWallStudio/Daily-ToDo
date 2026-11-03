const APP_BASE = new URL('./', self.location.href);
const CACHE_PREFIX = `daily-life-log:${APP_BASE.pathname}:`;
// Replaced by scripts/build.mjs for every production build.
const CACHE = `${CACHE_PREFIX}mvyxpr6t-local`;
const ASSETS = ['./', './index.html', './manifest.webmanifest', './src/app.js', './src/model.js', './src/storage.js', './src/dates.js', './src/styles.css', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== APP_BASE.origin || !url.pathname.startsWith(APP_BASE.pathname)) return;
  event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => {
    if (response.ok) {
      const clone = response.clone();
      return caches.open(CACHE).then(cache => cache.put(event.request, clone)).then(() => response);
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match(new URL('index.html', APP_BASE)) : Response.error()))));
});
