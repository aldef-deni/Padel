# Instance demo: demo.padel.aldeftech.com

Situs demo untuk calon klien. Login **`demo` / `demo`** (super admin), semua fitur bisa dicoba,
dan data kembali ke kondisi awal **setiap hari pukul 00:00 WIB**.

Demo terpisah penuh dari produksi: database `padel_demo`, API sendiri di port 3001, folder data
`/opt/padel/data/demo/`, prefix antrean `padel-demo`, dan tanpa SMTP (kode email hanya ke log).
Akun `demo` tidak bisa dipakai di padel.aldeftech.com. Web yang dipakai sama dengan produksi
(`apps/web/dist`); banner & petunjuk login demo muncul karena `GET /api/public/config` di API demo.

| Komponen | Keterangan |
|---|---|
| `padel-api-demo.service` | Build API yang sama, `ENV_FILE=.env.demo` (`apps/api/.env.demo`, tidak di-commit), port 3001 |
| `padel-demo-camera@{1,2,3}.service` | Kamera sintetis: `demo-camera.sh` memutar `court-N.mp4` berulang ke MediaMTX `court-demo-N` (tanpa encode ulang, CPU ~0) |
| `padel-demo-reset.service` + `.timer` | `pnpm demo:reset` setiap 17:00 UTC (00:00 WIB) |
| `render-video.sh` | Membuat video sintetis (lapangan, pemain, bola, REC) + klip contoh 30 dtk; cukup sekali |
| `infra/deploy/nginx-padel-demo.conf` | nginx + TLS untuk subdomain (noindex) |

Karena kamera demo di-publish seperti kamera asli, MediaMTX benar-benar merekamnya: live view,
status perekaman, dan tombol replay di halaman sesi menghasilkan klip sungguhan dari rekaman.
Riwayat dua minggu (sesi & ±1000 klip) dibuat oleh seed dari klip contoh memakai hard link,
jadi hampir tidak memakan disk. Rekaman 3 kamera demo di MediaMTX ±2 GB (buffer 2 jam).

## Data demo (`apps/api/scripts/demo-reset.ts`)

- Klub: Aldef Padel Arena (4 lapangan, 3 kamera live + 1 offline, 2 sesi aktif, layar TV),
  Aldef Padel Bali (2 lapangan, kamera offline), Aldef Padel Bandung (nonaktif).
- Admin klub `admin.arena`, `kasir.arena`, `admin.bali`, `admin.bandung` (password acak, tidak dipakai).
- 40 pemain (email `@example.com`), keanggotaan, catatan, 1 pemain diblokir.
- Sesi dua minggu terakhir di jam buka + klip replay (sebagian gagal karena kamera offline).
- Turnamen: Aldef Open 2026 (selesai, ada juara & juara 3), Liga Mixed Oktober (grup berjalan),
  Turnamen Pemula November (pendaftaran), Women Cup 2026 (draft), Bali Sunset Cup (berjalan).

Seed memakai angka acak dengan seed tetap, tanggal relatif terhadap waktu reset. Skrip menolak
berjalan kecuali `DEMO_MODE=true`, nama database mengandung `demo`, dan semua folder/prefix
adalah milik demo, jadi tidak mungkin menghapus data produksi.

## Operasional

```bash
sudo systemctl start padel-demo-reset        # reset sekarang (±10 detik)
systemctl list-timers padel-demo-reset.timer  # jadwal reset berikutnya
journalctl -u padel-api-demo -f               # log API demo (kode email pemain ada di sini)
systemctl status 'padel-demo-camera@*'        # kamera sintetis
```

## Pasang dari nol

```bash
docker exec padel-postgres-1 psql -U padel -d padel -c "CREATE DATABASE padel_demo OWNER padel"
# apps/api/.env.demo: salin dari .env.example; DEMO_MODE=true, PORT=3001,
# DATABASE_URL=.../padel_demo, JWT_SECRET baru, BULLMQ_PREFIX=padel-demo,
# CLIPS_DIR/LOGOS_DIR/AVATARS_DIR=/opt/padel/data/demo/..., SMTP_HOST= (kosong)
cd apps/api && DATABASE_URL=<url padel_demo> pnpm exec prisma migrate deploy
infra/demo/render-video.sh                     # ±10 menit, sekali saja
sudo cp infra/demo/*.service infra/demo/*.timer /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now padel-demo-camera@1 padel-demo-camera@2 padel-demo-camera@3
ENV_FILE=.env.demo pnpm demo:reset
sudo systemctl enable --now padel-api-demo padel-demo-reset.timer
# nginx + sertifikat: lihat infra/deploy/README.md (sama seperti produksi, domain demo.padel.aldeftech.com)
```
