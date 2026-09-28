# Deploy produksi: padel.aldeftech.com

Satu VM: nginx (TLS Let's Encrypt) di depan web statis, API NestJS (systemd) dan MediaMTX (Docker).

| Komponen | Lokasi di server | Salinan di repo |
|---|---|---|
| nginx site | `/etc/nginx/sites-available/padel` (symlink di `sites-enabled`) | `nginx-padel.conf` |
| nginx site demo | `/etc/nginx/sites-available/padel-demo` | `nginx-padel-demo.conf` |
| Service API | `/etc/systemd/system/padel-api.service` | `padel-api.service` |
| Sertifikat | `/etc/letsencrypt/live/padel.aldeftech.com/`, `.../demo.padel.aldeftech.com/` | – |
| Hook perpanjangan | `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` (reload nginx) | – |
| Web statis | `/opt/padel/apps/web/dist` (hasil build) | – |

Alur request: `https://padel.aldeftech.com` → nginx →
`/` web statis (SPA), `/api` + `/docs` + `/socket.io` → API `127.0.0.1:3000`,
`/media/hls` → MediaMTX `127.0.0.1:8888`, `/media/webrtc` → `127.0.0.1:8889`,
`/downloads/` → file di `/opt/padel/data/downloads/` (APK aplikasi pemain untuk testing).
Media WebRTC (UDP 8189), RTMP 1935 dan SRT 8890 tetap langsung ke IP server.

## Update aplikasi

```bash
cd /opt/padel && git pull
pnpm install
pnpm --filter @padel/api exec prisma migrate deploy
# database demo juga (URL dari apps/api/.env.demo)
(cd apps/api && DATABASE_URL=$(grep ^DATABASE_URL= .env.demo | cut -d= -f2-) pnpm exec prisma migrate deploy)
pnpm --filter @padel/api build && sudo systemctl restart padel-api padel-api-demo
pnpm --filter @padel/web build          # langsung dipakai nginx (produksi & demo), tanpa restart
```

Instance demo (demo.padel.aldeftech.com, reset harian): lihat `infra/demo/README.md`.

Log API: `journalctl -u padel-api -f`. Status: `systemctl status padel-api nginx`.

## Konfigurasi terkait

- `apps/api/.env`: `APP_PUBLIC_URL=https://padel.aldeftech.com` (dipakai di QR sesi & link TV).
- `apps/web/.env`: `VITE_MEDIA_PUBLIC_HOST=padel.aldeftech.com` (URL publish kamera), berlaku saat build.
- API listen di `127.0.0.1` (env `HOST`) dan memakai `trust proxy = loopback`, jadi rate limit
  memakai IP klien asli dari nginx.

## Sertifikat

Diterbitkan dengan certbot (webroot `/var/www/letsencrypt`), tanpa email akun.
Perpanjangan otomatis lewat `certbot.timer`; uji dengan `sudo certbot renew --dry-run`.
Tambah email untuk notifikasi kedaluwarsa: `sudo certbot update_account --email <email>`.

## Pasang ulang dari nol

```bash
sudo apt-get install -y nginx certbot
sudo mkdir -p /var/www/letsencrypt
# 1) sementara pakai hanya blok server :80 dari nginx-padel.conf, lalu:
sudo certbot certonly --webroot -w /var/www/letsencrypt -d padel.aldeftech.com \
  --agree-tos --register-unsafely-without-email
# 2) pasang config lengkap + service
sudo cp infra/deploy/nginx-padel.conf /etc/nginx/sites-available/padel
sudo ln -sf /etc/nginx/sites-available/padel /etc/nginx/sites-enabled/padel
sudo nginx -t && sudo systemctl reload nginx
sudo cp infra/deploy/padel-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now padel-api
```
