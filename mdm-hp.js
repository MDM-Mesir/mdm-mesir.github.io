// Fitur HP untuk halaman MDM di mdm-mesir.github.io:
// notifikasi aplikasi (Firebase), bagikan & simpan gambar, dan service worker.
// Dipanggil oleh halaman lewat window.MDM_HP.tanya(...) dan window.MDM_HP.kirim(...).
(function () {
  function kotak(id, isi) {
    var d = document.getElementById(id);
    if (d) return d;
    d = document.createElement('div');
    d.id = id;
    d.style.cssText = 'display:none;position:fixed;left:16px;right:16px;bottom:24px;z-index:9999;background:#fff;border-radius:14px;' +
      'box-shadow:0 4px 18px rgba(0,0,0,.25);padding:16px;font-family:Arial,sans-serif;text-align:center';
    d.innerHTML = isi;
    document.body.appendChild(d);
    return d;
  }
  var gayaTombol = 'padding:10px 22px;border:0;border-radius:10px;background:#c1603a;color:#fff;font-size:16px';

  // ---------- Bagikan / simpan gambar ----------
  function keBerkas(dataUrl, nama) {
    var b = atob(dataUrl.split(',')[1]), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return new File([u], nama || 'rekap.png', { type: 'image/png' });
  }
  function simpanGambar(dataUrl, nama) {
    var a = document.createElement('a'); a.href = dataUrl; a.download = nama || 'rekap.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function bagikanGambar(dataUrl, nama) {
    var berkas = keBerkas(dataUrl, nama);
    if (!(navigator.canShare && navigator.canShare({ files: [berkas] }))) {
      return Promise.resolve({ mdm: 'bagikanHasil', ok: false, alasan: 'HP ini belum mendukung tombol Bagikan. Tekan lama gambar, lalu pilih Bagikan / Simpan.' });
    }
    function bagikan() { return navigator.share({ files: [berkas], title: nama }); }
    return bagikan().then(function () { return { mdm: 'bagikanHasil', ok: true }; }).catch(function (x) {
      if (x && x.name === 'AbortError') return { mdm: 'bagikanHasil', ok: true };
      // Browser meminta ketukan langsung: tampilkan tombol
      var k = kotak('kotakBagikan', '<div style="margin-bottom:10px">Gambar siap dibagikan.</div>' +
        '<button id="tombolBagikanGambar" style="' + gayaTombol + '">📤 Bagikan gambar</button>' +
        '<button id="tombolBatalBagikan" style="padding:10px 16px;border:0;border-radius:10px;background:#eee;font-size:16px;margin-left:6px">Batal</button>');
      k.style.display = 'block';
      document.getElementById('tombolBagikanGambar').onclick = function () { k.style.display = 'none'; bagikan().catch(function () {}); };
      document.getElementById('tombolBatalBagikan').onclick = function () { k.style.display = 'none'; };
      return { mdm: 'bagikanHasil', ok: true };
    });
  }

  // ---------- Notifikasi aplikasi (Firebase Cloud Messaging) ----------
  var pesanFcm = null;
  function notifDidukung() {
    return !!(window.MDM_FIREBASE && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window);
  }
  function muatSkrip(src) {
    return new Promise(function (ok, gagal) {
      var s = document.createElement('script'); s.src = src; s.onload = ok;
      s.onerror = function () { gagal(new Error('Tidak bisa memuat ' + src)); };
      document.head.appendChild(s);
    });
  }
  function fcm() {
    if (pesanFcm) return Promise.resolve(pesanFcm);
    var v = 'https://www.gstatic.com/firebasejs/10.12.2/';
    return (window.firebase ? Promise.resolve() : muatSkrip(v + 'firebase-app-compat.js').then(function () { return muatSkrip(v + 'firebase-messaging-compat.js'); }))
      .then(function () {
        if (!firebase.apps.length) firebase.initializeApp(MDM_FIREBASE.config);
        pesanFcm = firebase.messaging();
        return pesanFcm;
      });
  }
  function namaPerangkat() {
    var u = navigator.userAgent;
    var hp = /iPhone|iPad/.test(u) ? 'iPhone' : /Android/.test(u) ? 'Android' : 'Komputer';
    var br = /Edg\//.test(u) ? 'Edge' : /SamsungBrowser/.test(u) ? 'Samsung' : /CriOS|Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Browser';
    return hp + ' · ' + br;
  }
  function mintaIzin() {
    return Notification.requestPermission().then(function (p) {
      if (p !== 'default') return p;
      return new Promise(function (selesai) {
        var k = kotak('izinNotif', '<div style="margin-bottom:10px">Ketuk tombol di bawah untuk mengizinkan notifikasi MDM di HP ini.</div>' +
          '<button id="tombolIzin" style="' + gayaTombol + '">🔔 Izinkan notifikasi</button>');
        k.style.display = 'block';
        document.getElementById('tombolIzin').onclick = function () {
          k.style.display = 'none';
          Notification.requestPermission().then(selesai);
        };
      });
    });
  }
  function aktifkanNotif() {
    function gagal(alasan) { return { mdm: 'notifGagal', alasan: alasan }; }
    if (!notifDidukung()) return Promise.resolve(gagal('HP / browser ini belum mendukung notifikasi aplikasi.'));
    return mintaIzin().then(function (p) {
      if (p !== 'granted') return gagal('Notifikasi tidak diizinkan. Buka pengaturan situs mdm-mesir.github.io di browser, lalu izinkan Notifikasi.');
      return Promise.all([navigator.serviceWorker.ready, fcm()]).then(function (h) {
        return h[1].getToken({ vapidKey: MDM_FIREBASE.vapidKey, serviceWorkerRegistration: h[0] });
      }).then(function (t) {
        if (!t) return gagal('Gagal mendaftarkan HP ini. Coba lagi.');
        localStorage.setItem('mdm_fcm_token', t);
        return { mdm: 'notifToken', token: t, ket: namaPerangkat() };
      });
    }).catch(function (x) { return gagal('Gagal mengaktifkan notifikasi: ' + (x && x.message ? x.message : x)); });
  }
  function matikanNotif() {
    try { localStorage.removeItem('mdm_fcm_token'); } catch (x) {}
    if (notifDidukung()) fcm().then(function (m) { return m.deleteToken(); }).catch(function () {});
  }
  function statusNotif() {
    var t = null;
    try { t = localStorage.getItem('mdm_fcm_token'); } catch (x) {}
    return { mdm: 'notifStatus', didukung: notifDidukung(), izin: window.Notification ? Notification.permission : 'denied', token: t };
  }

  window.MDM_HP = {
    // Pertanyaan yang butuh jawaban (hasilnya Promise)
    tanya: function (d) {
      try {
        if (d.mdm === 'notifStatus') return Promise.resolve(statusNotif());
        if (d.mdm === 'notifAktifkan') return aktifkanNotif();
        if (d.mdm === 'bagikanGambar') return bagikanGambar(d.data, d.nama);
        if (d.mdm === 'simpanGambar') { simpanGambar(d.data, d.nama); return Promise.resolve({ mdm: 'simpanHasil', ok: true }); }
      } catch (x) {}
      return Promise.resolve(null);
    },
    // Perintah tanpa jawaban
    kirim: function (d) {
      if (d && d.mdm === 'notifMatikan') matikanNotif();
      // 'simpan' / 'hapus' kunci login sudah ditangani halaman lewat localStorage
    }
  };

  if (navigator.serviceWorker) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
