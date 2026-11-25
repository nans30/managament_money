const CACHE_NAME = 'dompet-tenang-v4';
const MAX_CACHE_ENTRIES = 35;
const OFFLINE_ASSETS = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Bersihkan seluruh cache versi lama agar penyimpanan HP tetap ringan
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

// Pangkas cache jika melebihi batas MAX_CACHE_ENTRIES (FIFO) supaya cache tidak membengkak
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    const excess = keys.length - maxItems;
    for (let i = 0; i < excess; i++) {
      const req = keys[i];
      if (req && !OFFLINE_ASSETS.includes(new URL(req.url).pathname)) {
        await cache.delete(req);
      }
    }
  }
}

function shouldCachePath(pathname) {
  if (OFFLINE_ASSETS.includes(pathname)) return true;
  // Hanya cache aset statis Next.js yang dibutuhkan offline, hindari HMR & API dinamis
  if (pathname.startsWith('/_next/static/')) return true;
  return false;
}

// Strategi Network-First untuk halaman utama & Cache-First ringan untuk aset statis
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!shouldCachePath(url.pathname)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(async (cache) => {
            await cache.put(event.request, clone);
            await trimCache(CACHE_NAME, MAX_CACHE_ENTRIES);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});
