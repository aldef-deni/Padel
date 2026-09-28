# apps/web

Dashboard admin klub: React 19 + Vite 8 + TypeScript + Tailwind v4 + TanStack Query +
React Router + i18next (ID default, EN) + hls.js. Tipe data dari `@padel/shared`.

## Menjalankan

Butuh API (`apps/api`) dan `infra/` (MediaMTX) yang jalan.

```bash
cp .env.example .env   # VITE_MEDIA_PUBLIC_HOST = IP publik untuk URL publish kamera
pnpm dev               # http://localhost:5173 (atau `pnpm dev` di root: api + web)
```

Login dengan akun admin (SUPER_ADMIN atau CLUB_ADMIN). Akun pemain ditolak.

## Halaman

| Route | Isi |
|---|---|
| `/login` | Login admin (email + password) |
| `/` | Dashboard: jumlah lapangan, kamera online, kartu per lapangan dengan status kamera (refresh 5 detik) |
| `/courts` | Tambah, ubah nama, hapus lapangan |
| `/cameras` | Tambah, ubah, aktif/nonaktifkan, hapus kamera + status live & perekaman (replay tersedia sejak) |
| `/courts/:id` | Live stream tiap kamera + URL publish kamera |
| `/tv-setup` | Layar TV: unggah logo klub, buat/ganti link TV |
| `/tv/:clubId?key=` | **Kiosk TV** (tanpa login): layar idle dengan logo & jam; klip READY diputar otomatis layar penuh (antrean), chip "menyiapkan replay", kembali ke idle setelah selesai |
| `/replays` | Pustaka replay: statistik (total, hari ini, penyimpanan, gagal), filter lapangan/status/tanggal, putar, unduh, hapus klip |
| `/tournaments` | Turnamen: daftar per status + pencarian, buat turnamen (format, jadwal, biaya, aturan skor) |
| `/tournaments/:id` | Kelola turnamen: ringkasan & langkah berikutnya, tim, undian, jadwal & input skor, klasemen, bagan |
| `/t/:slug` | **Halaman publik turnamen** (tanpa login): bagan, klasemen, jadwal, tim; refresh otomatis 30 detik |
| `/courts/:id/session` | Sesi & Replay: mulai/akhiri sesi, QR join, simulasi tombol REPLAY, daftar klip (update realtime via Socket.IO, putar & unduh) |

SUPER_ADMIN bisa memilih klub di header; CLUB_ADMIN otomatis ke klubnya.

## Tampilan & gambar brand

Font Inter (self-hosted via `@fontsource-variable/inter`), ikon `lucide-react`, Tailwind v4 dengan token
warna di `src/index.css`. Shell admin: sidebar gelap (`components/Layout.tsx`), primitive UI di
`components/ui.tsx`, logo & ilustrasi lapangan SVG di `components/brand.tsx`.

Gambar opsional (lihat `src/assets/brand/README.md`): `login-hero.jpg|webp` untuk panel login dan
`logo.svg|png` untuk logo platform. Terdeteksi saat build; tanpa file, dipakai ilustrasi SVG.

## Proxy (vite.config.ts)

| Path di browser | Diteruskan ke |
|---|---|
| `/api` | API NestJS `127.0.0.1:3000` |
| `/socket.io` | Socket.IO API (WebSocket) |
| `/media/webrtc` | MediaMTX WebRTC/WHEP `127.0.0.1:8889` |
| `/media/hls` | MediaMTX HLS `127.0.0.1:8888` (hanya localhost) |

Header `Location` dari MediaMTX di-prefix ulang supaya redirect HLS & sesi WHEP tetap lewat proxy.
Media WebRTC sendiri lewat UDP 8189 langsung ke server (additional host di `mediamtx.yml`).
Untuk produksi, reverse proxy (mis. nginx) harus meniru aturan yang sama.

## Live player

WebRTC (WHEP, latensi rendah) lebih dulu; kalau tidak tersambung dalam 10 detik, otomatis beralih ke
HLS. Bisa juga dipilih manual (tombol WebRTC/HLS). hls.js hanya dimuat saat HLS dipakai.

Catatan: WebRTC tidak mendukung audio AAC, jadi audio kamera (umumnya AAC) hanya terdengar di HLS.

## Layar TV

Buka link dari menu **Layar TV** di browser TV, idealnya mode kiosk, mis.
`chromium --kiosk --autoplay-policy=no-user-gesture-required "<link TV>"`.
Video diputar tanpa suara (syarat autoplay browser). Halaman meminta Wake Lock agar layar tidak tidur
(hanya di konteks aman: https atau localhost). Jika admin membuat link baru, TV lama langsung
menampilkan "link tidak valid".

## Instance demo

Di demo.padel.aldeftech.com, `GET /api/public/config` mengembalikan akun demo: halaman login
menampilkan kotak "Coba akun demo" (isi otomatis) dan layout menampilkan banner hitung mundur
reset harian. Build web sama dengan produksi.
