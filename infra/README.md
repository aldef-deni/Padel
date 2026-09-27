# Infra: PostgreSQL, Redis, MediaMTX

Semua service dijalankan dengan Docker Compose dari folder ini.

## Menjalankan

```bash
cd /opt/padel/infra
cp .env.example .env   # lalu isi password asli; .env tidak di-commit
docker compose up -d
docker compose ps
```

Data disimpan di disk data:

- `/opt/padel/data/postgres`: data PostgreSQL
- `/opt/padel/data/redis`: data Redis (AOF)
- `/opt/padel/data/recordings/<path>/`: rekaman fmp4 MediaMTX, dihapus otomatis setelah 2 jam

## Port

| Port | Service | Akses |
|---|---|---|
| 5432/tcp | PostgreSQL | 127.0.0.1 saja |
| 6379/tcp | Redis | 127.0.0.1 saja |
| 1935/tcp | MediaMTX RTMP (ingest kamera) | publik |
| 8890/udp | MediaMTX SRT (ingest kamera) | publik |
| 8889/tcp | MediaMTX WebRTC (halaman & signaling) | publik |
| 8189/udp | MediaMTX WebRTC ICE (media) | publik |
| 8888/tcp | MediaMTX HLS | 127.0.0.1 saja |
| 9996/tcp | MediaMTX playback server (ambil potongan rekaman) | 127.0.0.1 saja |
| 9997/tcp | MediaMTX API | 127.0.0.1 saja |

RTSP dan MoQ dimatikan. Port publik juga harus diizinkan di firewall GCP.

## Kamera

Kamera publish ke path `court-<id>` dengan kredensial `CAMERA_USER` / `CAMERA_PASS` dari `.env`:

- RTMP: `rtmp://35.219.32.52:1935/court-1?user=<CAMERA_USER>&pass=<CAMERA_PASS>`
- SRT: `srt://35.219.32.52:8890?streamid=publish:court-1:<CAMERA_USER>:<CAMERA_PASS>`

> **Penting:** kamera harus mengirim **H.264 tanpa B-frames**. Matikan fitur
> **H.264+ / Smart Codec** (dan sejenisnya, mis. H.265+) di pengaturan kamera.
> Stream dengan B-frames tetap masuk dan terekam, tetapi **tidak tampil di WebRTC**.

## Stream uji

Mensimulasikan kamera 1080p60 ke `court-1` (tanpa B-frames):

```bash
cd /opt/padel/infra
set -a; . ./.env; set +a
ffmpeg -re -f lavfi -i testsrc2=size=1920x1080:rate=60 -f lavfi -i sine=frequency=1000:sample_rate=48000 \
  -c:v libx264 -preset ultrafast -tune zerolatency -bf 0 -pix_fmt yuv420p -g 60 -b:v 6M \
  -c:a aac -b:a 128k \
  -f flv "rtmp://127.0.0.1:1935/court-1?user=$CAMERA_USER&pass=$CAMERA_PASS"
```

Cek hasilnya:

```bash
# Status path (harus "ready": true)
curl -s http://127.0.0.1:9997/v3/paths/get/court-1

# Tonton live di browser
#   http://35.219.32.52:8889/court-1/

# Daftar rekaman & ambil potongan 10 detik dari playback server
curl -s "http://127.0.0.1:9996/list?path=court-1"
curl -o clip.mp4 "http://127.0.0.1:9996/get?path=court-1&start=<RFC3339>&duration=10&format=mp4"
```

Publish tanpa kredensial harus ditolak (`Operation not permitted`).
