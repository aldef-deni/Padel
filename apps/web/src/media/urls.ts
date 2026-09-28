// Proxied by Vite (see vite.config.ts) to MediaMTX on localhost.
export const whepUrl = (streamPath: string) => `/media/webrtc/${encodeURIComponent(streamPath)}/whep`
export const hlsUrl = (streamPath: string) => `/media/hls/${encodeURIComponent(streamPath)}/index.m3u8`

/** Public host cameras publish to (VITE_MEDIA_PUBLIC_HOST), else the host of this page. */
const publicHost = import.meta.env.VITE_MEDIA_PUBLIC_HOST || window.location.hostname

/** Publish URLs to configure in the camera; credentials come from infra/.env. */
export function publishUrls(streamPath: string, host = publicHost) {
  return {
    rtmp: `rtmp://${host}:1935/${streamPath}?user=<CAMERA_USER>&pass=<CAMERA_PASS>`,
    srt: `srt://${host}:8890?streamid=publish:${streamPath}:<CAMERA_USER>:<CAMERA_PASS>`,
  }
}
