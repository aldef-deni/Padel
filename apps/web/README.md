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
| `/cameras` | Tambah, ubah, aktif/nonaktifkan, hapus kamera + status live |
| `/courts/:id` | Live stream tiap kamera + URL publish kamera |

SUPER_ADMIN bisa memilih klub di header; CLUB_ADMIN otomatis ke klubnya.

## Proxy (vite.config.ts)

| Path di browser | Diteruskan ke |
|---|---|
| `/api` | API NestJS `127.0.0.1:3000` |
| `/media/webrtc` | MediaMTX WebRTC/WHEP `127.0.0.1:8889` |
| `/media/hls` | MediaMTX HLS `127.0.0.1:8888` (hanya localhost) |

Header `Location` dari MediaMTX di-prefix ulang supaya redirect HLS & sesi WHEP tetap lewat proxy.
Media WebRTC sendiri lewat UDP 8189 langsung ke server (additional host di `mediamtx.yml`).
Untuk produksi, reverse proxy (mis. nginx) harus meniru aturan yang sama.

## Live player

WebRTC (WHEP, latensi rendah) lebih dulu; kalau tidak tersambung dalam 10 detik, otomatis beralih ke
HLS. Bisa juga dipilih manual (tombol WebRTC/HLS). hls.js hanya dimuat saat HLS dipakai.

Catatan: WebRTC tidak mendukung audio AAC, jadi audio kamera (umumnya AAC) hanya terdengar di HLS.
