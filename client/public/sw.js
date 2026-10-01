const CACHE_NAME = 'lumqr-cache-v6';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Bypass map tile servers so browser fetches map tiles natively
  if (e.request.url.includes('cartocdn.com') || e.request.url.includes('openstreetmap.org')) {
    return;
  }

  // Check if API call
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline API access. Connection lost.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Network-first strategy with robust cache & SPA navigation fallback
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;

        // For navigation requests (HTML pages) when offline, return the cached SPA shell index.html
        if (e.request.mode === 'navigate' || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'))) {
          const indexPage = await caches.match('/index.html') || await caches.match('/');
          if (indexPage) return indexPage;
        }
        
        return new Response('', { status: 404, statusText: 'Offline or Not Found' });
      })
  );
});
