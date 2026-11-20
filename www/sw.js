/* পাঠাগার service worker — app shell precache + API network-first */
const VERSION = 'ptg-v1.0.0';
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest', 'catalog-snapshot.json',
  'css/app.css',
  'js/main.js', 'js/config.js', 'js/utils.js', 'js/db.js', 'js/net.js',
  'js/catalog.js', 'js/dlqueue.js', 'js/router.js', 'js/updater.js', 'js/reader.js',
  'js/views/home.js', 'js/views/branch.js', 'js/views/book.js',
  'js/views/library.js', 'js/views/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.png', 'icons/apple-touch-icon.png',
  'assets/fonts/NotoSansBengali-Regular.woff2', 'assets/fonts/NotoSansBengali-Bold.woff2',
  'vendor/capacitor/capacitor-core.js',
  'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(PRECACHE.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

const API_HOST = 'https://books.tetashweb.xyz';

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* PDF proxy path (/pdf/...) on our own origin: pass through, never cache —
     saved chapters live in IndexedDB, not the SW cache. */
  if (url.origin === self.location.origin && url.pathname.startsWith('/pdf/')) return;

  /* guide API: network-first with cache fallback (offline catalogs) */
  if (url.origin === API_HOST) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok) {
          const cache = await caches.open(VERSION);
          cache.put(req, r.clone());
        }
        return r;
      } catch {
        const c = await caches.match(req);
        if (c) return c;
        return new Response(JSON.stringify({ data: [], offline: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
    })());
    return;
  }

  /* same-origin app shell: stale-while-revalidate */
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      const fresh = fetch(req).then((r) => {
        if (r.ok) caches.open(VERSION).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => null);
      if (cached) { fresh.catch(() => {}); return cached; }
      const r = await fresh;
      if (r) return r;
      if (req.mode === 'navigate') {
        const shell = await caches.match('index.html');
        if (shell) return shell;
      }
      return new Response('অফলাইন', { status: 503 });
    })());
  }
});
