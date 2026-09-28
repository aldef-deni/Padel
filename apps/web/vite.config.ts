import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

// MediaMTX HLS & WebRTC hanya listen di localhost, jadi browser mengaksesnya
// lewat proxy ini: /media/hls -> :8888, /media/webrtc -> :8889 (sinyal WHEP;
// media WebRTC tetap lewat UDP 8189 langsung ke server).
function mediaProxy(prefix: string, target: string): ProxyOptions {
  return {
    target,
    rewrite: (path) => path.slice(prefix.length),
    configure: (proxy) => {
      // MediaMTX memakai redirect & Location absolut ("/court-1/..."): tambahkan prefix.
      proxy.on('proxyRes', (res) => {
        const location = res.headers.location
        if (location?.startsWith('/')) res.headers.location = prefix + location
      })
    },
  }
}

const proxy: Record<string, string | ProxyOptions> = {
  '/api': 'http://127.0.0.1:3000',
  '/media/hls': mediaProxy('/media/hls', 'http://127.0.0.1:8888'),
  '/media/webrtc': mediaProxy('/media/webrtc', 'http://127.0.0.1:8889'),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 4173, strictPort: true, proxy },
})
