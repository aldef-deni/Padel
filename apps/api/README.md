# apps/api

NestJS 12 + Prisma 7 (PostgreSQL via `@prisma/adapter-pg`). Port 3000, semua route di bawah `/api`.
Swagger UI di `/docs` (JSON: `/docs-json`).

## Setup

Butuh PostgreSQL dari `infra/` yang sudah jalan.

```bash
cp .env.example .env          # isi DATABASE_URL (sesuai infra/.env), JWT_SECRET, akun seed
pnpm install
pnpm db:generate              # generate Prisma Client ke src/generated/prisma
pnpm db:migrate               # terapkan migrasi (dev)
pnpm db:seed                  # 1 klub, 3 lapangan, kamera court-1..3, akun admin (idempoten)
pnpm start:dev
```

## Script

| Script | Fungsi |
|---|---|
| `start:dev` | generate client + jalankan dengan watch |
| `build` / `start:prod` | generate client + build ke `dist/` / jalankan hasil build |
| `db:migrate` | `prisma migrate dev` (buat & terapkan migrasi) |
| `db:deploy` | `prisma migrate deploy` (produksi) |
| `db:seed` | isi data contoh |
| `test:e2e` | uji e2e terhadap DB di `DATABASE_URL` (data uji dibersihkan sendiri) |

## Endpoint

| Resource | Route | Catatan |
|---|---|---|
| Health | `GET /api/health` | cek koneksi DB, publik |
| Auth | `/api/auth/...` | lihat di bawah |
| Club | `/api/clubs`, `/api/clubs/:id` | `slug` unik; profil: kota, deskripsi, telepon, email, website, Instagram, link Maps, jam buka/tutup, zona waktu, `isActive`, `logoUrl` |
| Daftar klub + statistik | `GET /api/clubs/stats?search=&status=ACTIVE\|INACTIVE&page=&pageSize=` | SUPER_ADMIN: lapangan, kamera, admin, sesi aktif, replay 30 hari per klub |
| Logo klub | `POST/DELETE /api/clubs/:id/logo` (admin), `GET /api/clubs/:id/logo` (publik) | multipart `file`: PNG/JPEG/WebP ≤ 1 MB (dicek dari isi file; SVG ditolak), disimpan di `LOGOS_DIR` |
| Layar TV | lihat di bawah | |
| Court | `/api/courts?clubId=`, `/api/courts/:id` | `name` unik per klub |
| Camera | `/api/cameras?courtId=&clubId=`, `/api/cameras/:id` | `streamPath` unik, pola `court-<id>` |
| Status kamera | `GET /api/cameras/status?clubId=` | online/offline dari API MediaMTX |
| Sesi & replay | lihat di bawah | |

Club/Court/Camera hanya untuk admin (lihat Autentikasi). Semua resource: `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id` (204).
Error: 400 validasi / relasi tidak ada, 404 tidak ditemukan, 409 duplikat atau masih dipakai
(mis. hapus klub yang masih punya lapangan).

## Autentikasi

JWT Bearer (`Authorization: Bearer <token>`), berlaku `JWT_EXPIRES_IN` (default 7d).
Semua route butuh token kecuali yang ditandai `@Public()` (health, login, OTP).

| Endpoint | Untuk | Body |
|---|---|---|
| `POST /api/auth/admin/login` | SUPER_ADMIN, CLUB_ADMIN | `{ login, password }`, `login` = email atau username |
| `POST /api/auth/otp/request` | pemain | `{ phone }`: `0812...` atau `+62812...` |
| `POST /api/auth/otp/verify` | pemain | `{ phone, code }` → akun PLAYER dibuat otomatis saat login pertama |
| `PATCH /api/auth/password` | SUPER_ADMIN, CLUB_ADMIN | `{ currentPassword, newPassword }` (min. 12 karakter) → token baru |
| `GET /api/auth/me` | semua | user yang sedang login |

**OTP:** 6 digit, berlaku 5 menit, kirim ulang paling cepat 60 detik, maksimal 5 percobaan per kode.
Untuk sekarang kode hanya ditulis ke log server (`WARN [OTP] OTP untuk +62...: 123456`).
Pengiriman WhatsApp nanti cukup mengganti provider `OTP_SENDER` di `auth.module.ts`.

**Hak akses CRUD:**

| | SUPER_ADMIN | CLUB_ADMIN | PLAYER |
|---|---|---|---|
| Buat/hapus klub | ✓ | ✗ | ✗ |
| Lihat/ubah klub | semua | klub sendiri | ✗ |
| Lapangan & kamera | semua | klub sendiri | ✗ |

Akses di luar hak → 403, tanpa/token salah → 401. Rate limit per IP: 120 req/menit umum,
lebih ketat di login/OTP (429 jika terlampaui).

**Klub nonaktif** (`isActive: false`, hanya SUPER_ADMIN yang bisa mengubah): admin klubnya tidak bisa login
(403 "Club is disabled") dan tokennya ditolak; mulai sesi, join, dan replay ditolak (403); link TV berhenti.
Klub hanya bisa dihapus jika tidak punya lapangan dan admin (409 jika masih ada).

**Membuat/memperbarui akun admin** (belum ada endpoint kelola user):

```bash
ADMIN_PASSWORD='...' pnpm user:admin --username <nama> [--email <email>] [--name "<Nama>"] \
  [--role SUPER_ADMIN|CLUB_ADMIN] [--club <clubId>]
```

Username: huruf kecil, 3–32 karakter `a-z 0-9 . _ -`. Password minimal 12 karakter. Jika akun sudah ada,
password & role diperbarui dan semua token lamanya dicabut.

Password disimpan dengan scrypt. Akun admin dibuat oleh `pnpm db:seed` dari
`SEED_ADMIN_*` dan `SEED_CLUB_ADMIN_*` di `.env`. Password hanya di-set saat akun dibuat,
jadi mengubah `.env` tidak mengganti password akun yang sudah ada; pakai `PATCH /api/auth/password`.
Setelah ganti password, semua token lama ditolak (401) dan respons berisi token baru.

Coba di Swagger: login di `/docs`, salin `accessToken`, klik **Authorize**.

## Profil & foto profil (semua pengguna yang login)

| Endpoint | Keterangan |
|---|---|
| `GET /api/auth/me` | Profil sendiri (+ `avatarUrl`, `lastLoginAt`, `createdAt`) |
| `PATCH /api/auth/me` | `{ name?, username?, email?, phone? }`; admin wajib tetap punya username/email; PLAYER tidak bisa ganti nomor di sini (lewat OTP) |
| `POST /api/auth/me/avatar` | multipart `file`: PNG/JPEG/WebP ≤ 2 MB (dicek dari isi file), disimpan di `AVATARS_DIR` |
| `DELETE /api/auth/me/avatar` | Hapus foto profil |
| `GET /api/users/:id/avatar` | Publik; `avatarUrl` memuat versi file sebagai cache-buster |

Web memotong & mengecilkan foto di browser (bingkai lingkaran, 512×512 WebP) sebelum upload.
`PATCH /api/auth/password` dengan password lama salah → **400** (bukan 401, agar klien tidak logout).

## Pemain klub (CLUB_ADMIN untuk klubnya, SUPER_ADMIN semua klub)

| Endpoint | Keterangan |
|---|---|
| `GET /api/clubs/:clubId/players?search=&status=ACTIVE\|BLOCKED&page=&pageSize=` | Daftar pemain klub + jumlah main, replay, terakhir main |
| `POST /api/clubs/:clubId/players` | `{ phone, name?, email?, note? }`; nomor yang sudah punya akun → akun itu ditautkan (`existingAccount: true`), data akunnya tidak ditimpa |
| `PATCH /api/clubs/:clubId/players/:userId` | Ubah nama/nomor/email, catatan internal, `isBlocked` |
| `DELETE /api/clubs/:clubId/players/:userId` | Keluarkan dari klub (akun & riwayat tetap) |

Akun PLAYER bersifat global; tabel `ClubMember` menandai pemain milik sebuah klub. Pemain otomatis
menjadi anggota saat join sesi lewat QR. Pemain yang **diblokir** di klub tidak bisa join sesi atau
meminta replay di klub itu (403), tetapi tetap bisa bermain di klub lain.

## Pengguna (SUPER_ADMIN)

| Endpoint | Keterangan |
|---|---|
| `GET /api/users?search=&role=&page=&pageSize=` | Daftar + `counts` per role (pencarian: nama, username, email, telepon) |
| `GET /api/users/:id` | Detail |
| `POST /api/users` | Buat pengguna |
| `PATCH /api/users/:id` | Ubah; field `null` = dikosongkan, `password` = reset (token lama dicabut) |
| `DELETE /api/users/:id` | Hapus (204) |

Aturan role: SUPER_ADMIN/CLUB_ADMIN wajib username atau email + password (min. 12), CLUB_ADMIN wajib `clubId`;
PLAYER wajib nomor HP (login OTP) dan tanpa password. `isActive: false` menolak login dan langsung
mencabut token yang ada. Pengaman: tidak bisa mengubah role/menonaktifkan/menghapus akun sendiri, tidak
bisa menghilangkan super admin aktif terakhir, dan pengguna yang punya klip tidak bisa dihapus (409,
nonaktifkan saja). Username/email/telepon unik (409).

## Sesi & replay

| Endpoint | Siapa | Keterangan |
|---|---|---|
| `POST /api/courts/:courtId/sessions` | admin | Mulai sesi (maks. 1 aktif per lapangan, 409 jika sudah ada) |
| `GET /api/courts/:courtId/sessions/active` | admin | `{ session: Session \| null }` |
| `GET /api/sessions/:id/qr` | admin | `{ qrToken, joinUrl, svg }`; `joinUrl = APP_PUBLIC_URL/join/<qrToken>` |
| `POST /api/sessions/:id/end` | admin | Akhiri sesi |
| `POST /api/sessions/join` | PLAYER | `{ qrToken }` → 404 token salah, 410 sesi berakhir |
| `GET /api/sessions/:id` | admin klub / pemain yang join | Detail sesi |
| `POST /api/sessions/:id/replays` | admin klub / pemain yang join | `{ durationSec? }` (5–120, default 30) → 202, 1 klip PENDING per kamera aktif |
| `GET /api/sessions/:id/clips` | admin klub / pemain yang join | Daftar klip + `downloadUrl` untuk yang READY |
| `GET /api/clips/:id/file?exp=&sig=` | publik, URL bertanda tangan | Video MP4 (Range didukung), berlaku 1 jam |

**Alur klip:** tombol replay membuat `Clip` PENDING (rentang `now - durationSec` s.d. `now`) dan job BullMQ
`clips` (delay 2 detik agar rekaman sudah ter-flush). Worker (di proses API, concurrency 2) mengambil
`MEDIAMTX_PLAYBACK_URL/get?path=&start=&duration=&format=mp4`, menyimpan ke `CLIPS_DIR/<clipId>.mp4`,
lalu READY. Gagal jaringan/5xx dicoba ulang 3x (backoff); 4xx (tidak ada rekaman, kamera offline)
langsung FAILED dengan pesan error.

**Socket.IO** (`/socket.io`): connect dengan `auth: { token: <JWT> }`, lalu
`emit('session:subscribe', { sessionId }, ack)`. Server mengirim `clip:updated` (objek `Clip`)
setiap klip dibuat atau berubah status. Nama event & tipe ada di `@padel/shared`.

**Test e2e** `test/replay.e2e-spec.ts` mem-publish stream uji sendiri dengan ffmpeg (kredensial dari
`infra/.env`) dan memakai prefix antrean `padel-e2e`, jadi aman dijalankan walau server dev menyala.

## Layar TV (kiosk)

| Endpoint | Siapa | Keterangan |
|---|---|---|
| `GET /api/clubs/:id/tv-link` | admin klub | `{ url }` atau `{ url: null }` |
| `POST /api/clubs/:id/tv-link` | admin klub | Buat kunci baru → `{ url }`; kunci lama langsung tidak berlaku dan TV yang terhubung diputus |
| `GET /api/tv/:clubId?key=` | publik + kunci | Data awal layar TV: klub (nama, logo), lapangan, kamera, 10 klip READY terbaru |

Link TV: `APP_PUBLIC_URL/tv/<clubId>?key=<kunci>` (kunci acak 24 byte, disimpan di `Club.tvKey`).
TV connect Socket.IO dengan `auth: { clubId, tvKey }`, otomatis masuk room klub dan menerima
`clip:updated` dari semua lapangan klub itu (TV tidak bisa subscribe ke sesi).
