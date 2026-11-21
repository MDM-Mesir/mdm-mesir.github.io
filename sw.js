// Service worker MDM: menyimpan "bingkai" aplikasi agar terbuka cepat dan
// menampilkan halaman offline jika tidak ada internet. Data tetap diambil langsung dari Apps Script.
var VERSI = 'mdm-v2';
var BERKAS = ['./', 'index.html', 'offline.html', 'manifest.webmanifest',
  'icons/logo.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSI).then(function (c) { return c.addAll(BERKAS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (x) { return x !== VERSI; }).map(function (x) { return caches.delete(x); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Apps Script & Google: langsung ke internet
  if (e.request.mode === 'navigate') {
    // Halaman utama: ambil versi terbaru dari internet, jika gagal pakai simpanan / halaman offline
    e.respondWith(fetch(e.request).then(function (r) {
      var salin = r.clone();
      caches.open(VERSI).then(function (c) { c.put('index.html', salin); });
      return r;
    }).catch(function () {
      return caches.match('offline.html');
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
});
