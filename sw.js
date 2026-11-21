// Service Worker: يخزن ملفات التطبيق حتى يفتح بدون إنترنت
const CACHE = 'pumps-v7';
const FILES = [
  './', './index.html', './styles.css', './app.js', './store.js', './config.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// ملفات الموقع: من الشبكة أولاً (حتى توصل التحديثات)، وإذا ماكو نت من الكاش
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
    // الخطوط ومكتبة Firebase ما تتغير: من الكاش أولاً حتى يفتح التطبيق بسرعة
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com' ||
      (url.host === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
