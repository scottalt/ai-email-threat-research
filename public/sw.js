const CACHE = 'threat-terminal-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.matchAll({ type: 'window' })).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Never intercept API routes
  if (new URL(event.request.url).pathname.startsWith('/api/')) return;
  // Navigation requests (HTML pages) — always fetch fresh, never cache
  // This ensures the PWA always loads the latest version without a hard refresh
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }
  // Static assets (JS, CSS, images) — network-first, fall back to cache for offline
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
