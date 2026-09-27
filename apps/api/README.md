# apps/api

NestJS 12 + Prisma 7 (PostgreSQL via `@prisma/adapter-pg`). Port 3000, semua route di bawah `/api`.
Swagger UI di `/docs` (JSON: `/docs-json`).

## Setup

Butuh PostgreSQL dari `infra/` yang sudah jalan.

```bash
cp .env.example .env          # isi DATABASE_URL sesuai infra/.env
pnpm install
pnpm db:generate              # generate Prisma Client ke src/generated/prisma
pnpm db:migrate               # terapkan migrasi (dev)
pnpm db:seed                  # 1 klub, 3 lapangan, kamera court-1..3 (idempoten)
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
| Health | `GET /api/health` | cek koneksi DB |
| Club | `/api/clubs`, `/api/clubs/:id` | `slug` unik |
| Court | `/api/courts?clubId=`, `/api/courts/:id` | `name` unik per klub |
| Camera | `/api/cameras?courtId=`, `/api/cameras/:id` | `streamPath` unik, pola `court-<id>` |

Semua resource: `POST`, `GET`, `GET :id`, `PATCH :id`, `DELETE :id` (204).
Error: 400 validasi / relasi tidak ada, 404 tidak ditemukan, 409 duplikat atau masih dipakai
(mis. hapus klub yang masih punya lapangan).
