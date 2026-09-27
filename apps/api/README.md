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
| Club | `/api/clubs`, `/api/clubs/:id` | `slug` unik |
| Court | `/api/courts?clubId=`, `/api/courts/:id` | `name` unik per klub |
| Camera | `/api/cameras?courtId=`, `/api/cameras/:id` | `streamPath` unik, pola `court-<id>` |

Club/Court/Camera hanya untuk admin (lihat Autentikasi). Semua resource: `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id` (204).
Error: 400 validasi / relasi tidak ada, 404 tidak ditemukan, 409 duplikat atau masih dipakai
(mis. hapus klub yang masih punya lapangan).

## Autentikasi

JWT Bearer (`Authorization: Bearer <token>`), berlaku `JWT_EXPIRES_IN` (default 7d).
Semua route butuh token kecuali yang ditandai `@Public()` (health, login, OTP).

| Endpoint | Untuk | Body |
|---|---|---|
| `POST /api/auth/admin/login` | SUPER_ADMIN, CLUB_ADMIN | `{ email, password }` |
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

Password disimpan dengan scrypt. Akun admin dibuat oleh `pnpm db:seed` dari
`SEED_ADMIN_*` dan `SEED_CLUB_ADMIN_*` di `.env`. Password hanya di-set saat akun dibuat,
jadi mengubah `.env` tidak mengganti password akun yang sudah ada; pakai `PATCH /api/auth/password`.
Setelah ganti password, semua token lama ditolak (401) dan respons berisi token baru.

Coba di Swagger: login di `/docs`, salin `accessToken`, klik **Authorize**.
