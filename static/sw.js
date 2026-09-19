// Ledger PWA Service Worker
const CACHE_NAME = 'ledger-v1';
const STATIC_ASSETS = [
  '/',
  '/static/css/ledger.css',
  '/static/css/components.css',
  '/static/js/api.js',
  '/static/js/charts.js',
  '/static/js/app.js',
  '/static/icons/logo-32.png',
  '/static/icons/logo-192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Always use network-first for API routes
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline - Unable to connect' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Network-first with cache fallback for static assets
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
