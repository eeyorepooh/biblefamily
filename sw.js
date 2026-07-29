// Bumping this version string forces the service worker to re-cache everything
// on the next visit — do this whenever you update any of the cached files below
// (including this file itself). NOTE: browsers only re-install a service worker
// when sw.js changes byte-for-byte, so editing index.html/bible.html/verse.html
// etc. WITHOUT also bumping this string means visitors keep getting the old,
// stale cached pages offline (and online, until they hard-refresh) — bump it
// every time any cached file changes.
const CACHE_NAME = 'bible-site-cache-v15';

// List every file the site needs in order to fully load with no network connection.
// Add any other pages/assets you have (e.g. index.html, manifest.json, icons) here.
// The "family" files are optional fallbacks used only if the primary content file
// (biblecontents.txt / versecontents.txt) isn't present — missing entries here are
// skipped gracefully (see the install handler below), so it's safe to list them even
// if you don't use the family variants.
const FILES_TO_CACHE = [
  './',
  './index.html',
  './bible.html',
  './verse.html',
  './biblecontents.txt',
  './biblecontentsfamily.txt',
  './versecontents.txt',
  './versecontentsfamily.txt',
  './manifest.json',
  './icon.png',
  './sw.js'
];

// On install: download and cache all listed files right away. Each file is fetched and
// cached independently — if one file is missing (e.g. icon.png not uploaded yet), the
// others still get cached instead of the whole install silently failing.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        FILES_TO_CACHE.map((url) =>
          // 'reload' bypasses the HTTP cache so we always grab the real latest copy of
          // each file from the network while precaching, rather than a stale browser-cached one.
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('Could not cache', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting(); // activate the new service worker as soon as it's installed
});

// On activate: delete any old cache versions left over from a previous CACHE_NAME,
// and take control of any already-open tabs immediately (instead of waiting for a
// reload) so the offline fix applies right away.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// On fetch: try the cache first (works offline instantly), fall back to the
// network if it's not cached yet, and cache whatever the network returns so it's
// available offline next time too. Navigation requests (e.g. opening the site fresh
// while offline, or reloading a page that fell out of cache) fall back to the
// cached index.html so the app still loads instead of showing a browser error page.
self.addEventListener('fetch', (event) => {
  // Only intercept simple GET requests — POST/PUT/etc. and cross-origin requests are
  // left to the browser's normal handling, since caches.put() only supports GET and
  // throws on anything else.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          // Only cache well-formed, successful, same-origin responses.
          if (!networkResponse || !networkResponse.ok || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone).catch((err) => {
              console.warn('Could not cache', event.request.url, err);
            });
          });
          return networkResponse;
        })
        .catch(async () => {
          // No cache and no network. For a page navigation, fall back to the cached
          // home page so the app still opens offline instead of a browser error page.
          if (event.request.mode === 'navigate') {
            const fallback = await caches.match('./index.html');
            if (fallback) return fallback;
          }
          return new Response('Offline and this file was not previously cached.', {
            status: 503,
            statusText: 'Offline'
          });
        });
    })
  );
});
