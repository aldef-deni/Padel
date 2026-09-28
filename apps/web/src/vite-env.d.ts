/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public IP/host of the media server shown in camera publish URLs. */
  readonly VITE_MEDIA_PUBLIC_HOST?: string
}
