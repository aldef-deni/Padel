# Padel Replay System

Sistem replay & live streaming lapangan padel (seperti PUSHIT).
Full cloud: kamera IP push RTMP/SRT langsung ke server, tanpa perangkat di lapangan.
Target awal: 1 klub, 2–3 lapangan, 1–2 kamera per lapangan (1080p60).

## Stack
- apps/api    : NestJS + Prisma + PostgreSQL, BullMQ + Redis, Socket.IO. Port 3000.
- apps/web    : React + Vite + TypeScript + Tailwind v4 + TanStack Query +
                React Router + i18next + hls.js. Port 5173, proxy /api -> 3000.
- apps/media  : (nanti) Python worker: potong klip, upload R2, AI.
- apps/mobile : (nanti) Expo app pemain.
- packages/shared : tipe TypeScript bersama API & web.
- infra/      : docker-compose (postgres:16, redis:7, mediamtx).
- Package manager: pnpm workspace.

## Alur inti
1. Kamera push ke MediaMTX path `court-<id>`. MediaMTX merekam fmp4 ke
   /opt/padel/data/recordings dan menghapus otomatis setelah 2 jam (rolling buffer).
2. Pemain masuk (sementara: kode ke email; OTP WhatsApp/SMS menyusul), scan QR lapangan ->
   bergabung ke Session aktif lapangan itu.
3. Pemain tekan tombol replay di app -> API membuat Clip (PENDING) -> job BullMQ.
4. Worker ambil potongan dari MediaMTX playback server
   (http://localhost:9996/get?path=court-1&start=<RFC3339>&duration=<detik>),
   simpan/upload, set status READY, kirim notifikasi Socket.IO ke pemain & layar TV.

## Peran pengguna
SUPER_ADMIN (pemilik platform), CLUB_ADMIN (pengelola klub), PLAYER (pemain).

## Konvensi
- UI default Bahasa Indonesia (i18next), siapkan Inggris.
- Semua rahasia di file .env (tidak di-commit). Sediakan .env.example.
- PostgreSQL & Redis hanya listen di 127.0.0.1.
- Kerjakan per fase kecil. Setelah tiap fase: jelaskan apa yang dibuat
  dan cara mengetesnya.

## Aturan Git (WAJIB)
- Semua commit menggunakan author: aldef-deni <deniafrizal2904@gmail.com>.
- DILARANG menambahkan "Co-Authored-By", "Generated with Claude Code",
  atau atribusi/kontributor lain dalam pesan commit maupun PR.
- Setelah pekerjaan selesai dan terverifikasi (test, typecheck, lint lulus),
  langsung commit dan push ke origin main tanpa perlu konfirmasi (instruksi pemilik, 2026-09-28).
  Jangan commit pekerjaan yang belum selesai atau masih gagal test.

## Produksi
- https://padel.aldeftech.com — nginx + Let's Encrypt, API sebagai service systemd `padel-api`.
  Detail & cara update: infra/deploy/README.md.
- https://demo.padel.aldeftech.com — instance demo (login demo/demo, super admin), terpisah penuh:
  DB `padel_demo`, service `padel-api-demo` (port 3001, `apps/api/.env.demo`), kamera sintetis,
  reset data harian 00:00 WIB. Setiap deploy API: migrasi & restart juga instance demo.
  Detail: infra/demo/README.md.

## Backlog
- Login pemain lewat OTP WhatsApp/SMS (pilihan channel) setelah penyedia dipilih; sementara lewat email.
- Refresh token (sekarang hanya access token 7 hari).
- Pembersihan berkala tabel OtpCode (kode kedaluwarsa/terpakai).
- Ganti password akun seed (admin@padel.local, klub@padel.local) sebelum go-live.
- Klip: pindah penyimpanan ke R2 (ganti ClipStorage), retensi/hapus file lama di /opt/padel/data/clips.
- Halaman/deep link `APP_PUBLIC_URL/join/<qrToken>` belum ada (untuk aplikasi pemain).
- Socket.IO Redis adapter jika API dijalankan lebih dari 1 instance.
- Logo klub: pindah ke R2 seperti klip.
- Worker klip masih di proses API; pindahkan ke apps/media jika perlu (antrean BullMQ `clips` sudah terpisah).
- Audio di WebRTC: kamera kirim AAC (tidak didukung WebRTC); perlu transcode ke Opus jika audio live dibutuhkan.
