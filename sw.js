// Service worker MDM: menyimpan halaman aplikasi agar terbuka cepat dan
// menampilkan halaman offline jika tidak ada internet. Data tetap diambil langsung dari Apps Script.
var VERSI = 'mdm-v6';
var BERKAS = ['./', 'index.html', 'offline.html', 'manifest.webmanifest', 'firebase-config.js', 'mdm-hp.js',
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

// ---------- Notifikasi (dikirim lewat Firebase Cloud Messaging) ----------
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { data: { body: e.data ? e.data.text() : '' } }; }
  var isi = d.data || d.notification || d;
  e.waitUntil(self.registration.showNotification(isi.title || 'MDM', {
    body: isi.body || '', icon: 'icons/icon-192.png', tag: isi.tag || undefined,
    data: { url: isi.url || './' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var tujuan = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (daftar) {
    for (var i = 0; i < daftar.length; i++) if ('focus' in daftar[i]) return daftar[i].focus();
    return self.clients.openWindow(tujuan);
  }));
});
