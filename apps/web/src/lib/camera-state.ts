import type { CameraStatus } from '@padel/shared'

export type CameraState = 'online' | 'offline' | 'inactive' | 'unknown'

export function cameraState(
  isActive: boolean,
  status: CameraStatus | undefined,
  mediaServerReachable: boolean | undefined,
): CameraState {
  if (!isActive) return 'inactive'
  if (mediaServerReachable === false || !status) return 'unknown'
  return status.online ? 'online' : 'offline'
}

/** "1920×1080 · H264" for an online camera. */
export function videoLabel(status: CameraStatus | undefined): string | null {
  const video = status?.online ? status.video : null
  if (!video) return null
  const size = video.width && video.height ? `${video.width}×${video.height} · ` : ''
  return `${size}${video.codec}`
}
