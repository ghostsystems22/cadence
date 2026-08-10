const CACHE='cadence-v1';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/','/manifest.webmanifest','/icon.svg']))));
self.addEventListener('fetch', event => { if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); return response; }))); });
