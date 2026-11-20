# Garasiku

Aplikasi Android (Expo + React Native + TypeScript) untuk mengurus kendaraan: odometer GPS otomatis, umur komponen, pengingat pajak STNK, rekam rute, dokumen digital, radar touring dengan SOS, dan Vehicle Passport PDF.

**Status data:** semua data disimpan **lokal di perangkat** (offline-first). Lapisan sinkronisasi ke **Supabase** sudah disiapkan dan otomatis aktif begitu `.env` diisi.

---

## 1. Menjalankan & build APK

Prasyarat: Node.js 20+, akun Expo (gratis) untuk build APK di cloud.

```bash
npm install
cp .env.example .env          # biarkan kosong dulu = mode lokal
```

### Build APK (paling mudah: EAS Build di cloud, tanpa Android Studio)

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview   # atau: npm run build:apk
```

Setelah selesai, EAS memberi link/QR untuk mengunduh file `.apk`, lalu tinggal diinstal di HP. Profil `preview` di `eas.json` sudah diatur ke `buildType: apk`. Untuk Play Store pakai profil `production` (menghasilkan `.aab`).

### Build lokal (butuh Android Studio + SDK)

```bash
npx expo run:android --variant release
```

### Development

Aplikasi ini memakai modul native (lokasi latar belakang, notifikasi, WebView, dll.), jadi **pakai development build, bukan Expo Go**:

```bash
npx eas-cli@latest build -p android --profile development   # sekali saja, instal APK-nya
npx expo start --dev-client
```

### Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm test` | 33 tes: logika inti (Haversine, filter, polyline, lifespan, pajak) + render semua layar + alur tambah kendaraan & servis |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (konfigurasi Expo) |

---

## 2. Pemetaan kebutuhan → implementasi

### Kebutuhan fungsional

| Kebutuhan | Implementasi |
|---|---|
| GPS 1 Hz (lat, lng, kecepatan, elevasi, timestamp) | `src/services/recorder.ts` — `startLocationUpdatesAsync` (foreground service Android, tetap jalan saat layar mati), `timeInterval: 1000`. Fallback `watchPositionAsync` bila izin "sepanjang waktu" ditolak. |
| Jarak Haversine → odometer | `src/lib/geo.ts` `haversine()`; jarak trip ditambahkan ke odometer kendaraan saat trip selesai. |
| Filter noise & outlier | `evaluateFix()`: buang kecepatan > 55 m/s, abaikan geseran < 1,5 m, buang akurasi > 50 m, re-anchor setelah 5 outlier beruntun. |
| Input manual odometer & tanggal servis | Layar **Atur Odometer** dan **Catat Servis**. |
| Component Lifespan Matrix (km ATAU bulan, mana duluan) | `src/lib/lifespan.ts` — oli, kampas rem, aki, busi, ban, filter udara, servis berkala; nilai default motor & mobil, bisa diubah di **Pengaturan**. |
| Status kesehatan & alarm di dashboard | Skor 0–100, daftar komponen "Segera"/"Lewat", notifikasi lokal saat status memburuk. |
| Pengingat pajak tahunan & 5 tahunan | `src/services/notifications.ts` — terjadwal H-30, H-7, H-1, H (STNK 5 th juga H-60). |
| Kalkulator pajak & denda | `src/lib/tax.ts` — PKB, opsen 66%, SWDKLLJ, PNBP STNK/TNKB, denda per bulan; semua tarif bisa diubah. |
| Upcoming Cost Estimator | `src/lib/cost.ts` — total biaya servis berkala + komponen yang jatuh tempo sebelum/sekitar servis berikutnya (proyeksi km/hari dari riwayat). |
| Rekam rute, jarak, kecepatan rata-rata, elevasi | `src/lib/tripCore.ts` — statistik inkremental, elevasi dengan histeresis 3 m, profil elevasi di detail trip. |
| Google Encoded Polyline + ekspor GPX | `src/lib/polyline.ts` (lulus contoh resmi Google), `src/lib/gpx.ts`, tombol **Ekspor GPX**. |
| Foto dokumen, resize, orientasi, JPEG/WebP | `src/services/documents.ts` — maks 1600 px, putar manual, kualitas 60/70/80, JPEG/WebP, perbandingan ukuran. |
| Group Touring Radar (update 2–5 dtk), jarak antar-anggota, notifikasi tertinggal, SOS, Private Room Code | `src/services/touring/` — update 2 detik, Haversine, status Dekat/Terpisah/Sinyal hilang/SOS, kode 6 karakter acak kriptografis, SOS dengan tahan 1,5 dtk. |
| Vehicle Passport PDF | `src/lib/passport.ts` + `expo-print`, berisi ID Paspor (SHA-256). |
| Penyimpanan lokal + sinkron REST saat online | Store Zustand + AsyncStorage, antrean `src/store/outbox.ts`, `src/services/sync.ts` (supabase-js = REST/HTTPS). |

### Kebutuhan non-fungsional

| Kebutuhan | Status |
|---|---|
| Kompresi rute ≥ 10:1 (target ±12:1) | Polyline + telemetri delta-encoded. Uji simulasi 1 jam @1 Hz: **25:1** vs JSON mentah. Rasio ditampilkan live & di detail trip. |
| Kompresi citra kualitas 60–80 | Pilihan 60/70/80 + pratinjau untuk cek keterbacaan teks. |
| Latensi radar < 2 dtk | Supabase Realtime (WebSocket) broadcast; latensi rata-rata ditampilkan di layar touring. |
| Offline-first | Semua fitur pencatatan berjalan tanpa internet. Peta butuh internet untuk memuat tile. |
| TLS/HTTPS | Semua panggilan Supabase lewat HTTPS/WSS. |
| AES-256 untuk dokumen di server | Supabase mengenkripsi database & Storage at-rest dengan AES-256; foto dikirim ke bucket **privat** dengan RLS per user. |
| OAuth2/JWT | Supabase Auth (JWT). Form masuk/daftar muncul di Pengaturan setelah Supabase dikonfigurasi. |

---

## 3. Struktur proyek

```
src/
  app/                 # layar (Expo Router)
    (tabs)/            # Beranda, Lacak, Servis, Touring, Lainnya
    trip/[id].tsx      # detail rute + kompresi + GPX
    service/edit.tsx   # catat servis + foto nota
    tax.tsx  documents.tsx  passport.tsx  settings.tsx  vehicle/edit.tsx  ...
  lib/                 # logika murni (teruji): geo, polyline, tripCore, lifespan, cost, tax, gpx, passport
  services/            # recorder (GPS), locationTask, notifications, documents, exporter, sync, touring/
  store/               # Zustand + AsyncStorage (vehicles, records, settings, outbox)
  components/          # UI kit, LeafletMap (WebView), DateField
supabase/schema.sql    # skema tabel + RLS + bucket Storage, siap dijalankan
```

---

## 4. Rencana migrasi ke Supabase

Semua perubahan data lokal **sudah dicatat di outbox** sejak hari pertama, jadi data lama ikut terkirim saat cloud diaktifkan.

1. Buat proyek di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan isi `supabase/schema.sql` (tabel `vehicles`, `service_records`, `trips`, `documents`, RLS, bucket privat `documents`).
3. Ambil **Project URL** dan **anon/publishable key** dari *Project Settings → API*, isi ke `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
   Untuk build EAS, daftarkan juga sebagai environment variable di EAS (`eas env:create`) atau di dashboard expo.dev.
4. Build ulang APK. Di aplikasi: **Lainnya → Pengaturan → Sinkronisasi cloud → Daftar/Masuk**. Antrean langsung terkirim.
5. Group Touring otomatis pindah dari mode demo ke **Supabase Realtime**. Untuk pengamanan room yang lebih ketat, lihat bagian "private channel" di akhir `schema.sql`.

Yang belum ada (tahap berikutnya): tarik data dari cloud ke perangkat baru (*pull/restore*), resolusi konflik multi-perangkat (saat ini *last-write-wins* per record), dan login Google/OAuth (tinggal aktifkan provider di Supabase Auth).

---

## 5. Catatan penting

- **Izin lokasi "Izinkan sepanjang waktu"** diperlukan agar odometer tetap merekam saat layar mati. Di HP Xiaomi/Oppo/Vivo, matikan juga *battery optimization* untuk Garasiku.
- **Peta** memakai Leaflet + OpenStreetMap di WebView (tanpa API key). Untuk rilis publik dengan banyak pengguna, ganti URL tile di `src/components/LeafletMap.tsx` ke penyedia berbayar/gratis-terbatas (MapTiler, Stadia, dsb.) sesuai kebijakan penggunaan tile OSM.
- **Mode demo touring**: tanpa Supabase, radar menampilkan 3 anggota simulasi (salah satunya sengaja tertinggal ±1 km) dan tombol "Simulasikan SOS" untuk menguji alarm.
- **Tarif pajak** adalah estimasi (PNBP PP 60/2016, SWDKLLJ, opsen PKB 66%). Tarif PKB dan denda berbeda per provinsi; ubah di layar Pajak → Tarif.
- Harga komponen di lifespan matrix adalah perkiraan umum; sesuaikan di Pengaturan.
