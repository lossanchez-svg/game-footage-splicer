/* Film Room service worker — makes the hosted app work offline / installable.

   The app itself is NETWORK-FIRST, the rest is cache-first. Cache-first on the
   app was wrong in a way that only shows up when it matters: it served the
   cached copy and refreshed in the background, so every update arrived one
   visit late. Someone testing a fix would run the old code, see the same bug,
   and reasonably conclude the fix did not work. Falling back to the cache when
   the network fails keeps it fully offline-capable. */
const CACHE = 'filmroom-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(a => c.add(a)))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const isApp = url => {
  const p = new URL(url).pathname;
  return p.endsWith('/') || p.endsWith('/index.html');
};

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  const fresh = () => fetch(e.request).then(res => {
    if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
    return res;
  });
  if (isApp(e.request.url)){
    // always try for the current build; the cache is the offline safety net
    e.respondWith(fresh().catch(() =>
      caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fresh().catch(() => hit))
  );
});
