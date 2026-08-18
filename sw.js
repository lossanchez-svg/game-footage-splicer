/* Film Room service worker — makes the hosted app work offline / installable.
   Cache-first: the app is fully self-contained, so serving the cached copy is
   always safe; a background refetch keeps the cache fresh for the next open. */
const CACHE = 'filmroom-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(a => c.add(a)))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const refetch = fetch(e.request).then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit || caches.match('./index.html'));
      return hit || refetch;
    })
  );
});
