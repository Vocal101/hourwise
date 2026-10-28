// Offline support: precache the app shell, serve from cache, refresh in the background.
// Bump VERSION whenever a file changes so installed copies pick up the new build.
const VERSION = 'hourwise-v1';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/actions.js',
  'js/calc.js',
  'js/charts.js',
  'js/data.js',
  'js/format.js',
  'js/pig.js',
  'js/schema.js',
  'js/store.js',
  'js/ui.js',
  'js/views/budget.js',
  'js/views/common.js',
  'js/views/home.js',
  'js/views/insights.js',
  'js/views/onboarding.js',
  'js/views/room.js',
  'js/views/save.js',
  'js/views/settings.js',
  'icons/favicon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  // Shared links arrive as index.html?title=…; answer them from the cached shell.
  const isPage = request.mode === 'navigate';
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(isPage ? 'index.html' : request, { ignoreSearch: true });
      const network = fetch(request)
        .then((res) => { if (res.ok && !isPage) cache.put(request, res.clone()); if (res.ok && isPage) cache.put('index.html', res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

// Tapping a reminder opens (or focuses) the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.tag?.startsWith('bill:') ? '#budget' : '#save/cooldown';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => new URL(w.url).origin === location.origin);
      if (win) { win.navigate?.(new URL(target, win.url).href); return win.focus(); }
      return self.clients.openWindow(`./${target}`);
    }),
  );
});
