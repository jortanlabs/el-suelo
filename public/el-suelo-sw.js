const CACHE = 'el-suelo-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('wikidata.org') || url.includes('wikipedia.org') || url.includes('itunes.apple.com')) return;

  // Network-first para archivos de datos: siempre pide la versión más reciente
  // (publicadas.json y catálogos cambian cuando el admin publica)
  if (url.includes('/data/') && url.endsWith('.json')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first para el resto (HTML, CSS, JS — tienen hash de contenido)
  e.respondWith(
    caches.match(e.request).then(cached => cached ?? fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});
