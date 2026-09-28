/** Frame the user positions the photo in (CSS px); the export scales it to OUTPUT_SIZE. */
export const CROP_FRAME = 288
export const OUTPUT_SIZE = 512

export interface CropState {
  zoom: number
  /** Offset of the image centre from the frame centre, in frame px. */
  x: number
  y: number
}

/** Displayed image size at zoom 1 is "cover": it fills the frame on the shorter side. */
export function displaySize(img: { width: number; height: number }, zoom: number) {
  const scale = Math.max(CROP_FRAME / img.width, CROP_FRAME / img.height) * zoom
  return { width: img.width * scale, height: img.height * scale }
}

/** Keeps the frame fully covered by the image. */
export function clampOffset(img: { width: number; height: number }, crop: CropState): CropState {
  const { width, height } = displaySize(img, crop.zoom)
  const maxX = (width - CROP_FRAME) / 2
  const maxY = (height - CROP_FRAME) / 2
  return { ...crop, x: Math.min(maxX, Math.max(-maxX, crop.x)), y: Math.min(maxY, Math.max(-maxY, crop.y)) }
}

/** Renders the framed area to a square WebP (PNG where WebP encoding is unsupported). */
export async function exportCrop(img: HTMLImageElement, crop: CropState): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const k = OUTPUT_SIZE / CROP_FRAME
  const { width, height } = displaySize({ width: img.naturalWidth, height: img.naturalHeight }, crop.zoom)
  ctx.drawImage(
    img,
    (CROP_FRAME / 2 - width / 2 + crop.x) * k,
    (CROP_FRAME / 2 - height / 2 + crop.y) * k,
    width * k,
    height * k,
  )
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('Could not encode image')
  return blob
}
