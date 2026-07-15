// Bumping this version string forces the service worker to re-cache everything
// on the next visit — do this whenever you update any of the cached files below.
const CACHE_NAME = 'bible-site-cache-v7';

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
  './icon.png'
];

// On install: download and cache all listed files right away. Each file is fetched and
// cached independently — if one file is missing (e.g. icon.png not uploaded yet), the
// others still get cached instead of the whole install silently failing.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        FILES_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('Could not cache', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting(); // activate the new service worker as soon as it's installed
});

// On activate: delete any old cache versions left over from a previous CACHE_NAME.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// On fetch: try the cache first (works offline instantly), fall back to the
// network if it's not cached yet, and cache whatever the network returns.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // No cache and no network — nothing more we can do for this request.
          return new Response('Offline and this file was not previously cached.', {
            status: 503,
            statusText: 'Offline'
          });
        });
    })
  );
});
