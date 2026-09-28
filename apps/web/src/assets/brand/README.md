# Gambar brand

| File | Dipakai di |
|---|---|
| `aldef-logo-2026.png` | Sumber asli logo Aldef Tech (1536×1024, transparan). Tidak ikut di-bundle. |
| `aldef-logo.webp` | Logo lengkap (emblem + tulisan), dipotong & dioptimasi dari sumber: panel login, login mobile. |
| `aldef-mark.webp` | Emblem "A" saja, persegi: sidebar & header mobile. |
| `../../public/favicon.png`, `apple-touch-icon.png` | Ikon tab browser & layar utama iOS (dari emblem). |
| `login-hero.jpg` / `.webp` (opsional) | Foto latar panel kiri login; tanpa file dipakai ilustrasi SVG. |

Membuat ulang dari sumber baru (butuh ffmpeg):

```bash
L=aldef-logo-2026.png
ffmpeg -y -i $L -vf "crop=1071:986:232:6,scale=720:-1:flags=lanczos" -c:v libwebp -quality 90 aldef-logo.webp
ffmpeg -y -i $L -vf "crop=921:733:288:4,pad=921:921:0:(oh-ih)/2:color=0x00000000,scale=256:256:flags=lanczos" -c:v libwebp -quality 92 aldef-mark.webp
```

(Nilai crop mengikuti batas logo 2026; sesuaikan jika logonya berubah.)
