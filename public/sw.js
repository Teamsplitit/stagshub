const CACHE = 'stagshub-v1';
const SHELL = ['/', '/manifest.json'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
    self.clients.claim();
});

// Network-first strategy for API, cache-first for shell
self.addEventListener('fetch', (e) => {
    if (e.request.url.includes('/api/')) return; // never cache API calls
    e.respondWith(
        caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
});
