import type { User } from '@padel/shared'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Loader2, Move, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { errorMessage } from '../lib/errors'
import { clampOffset, CROP_FRAME, displaySize, exportCrop, type CropState } from '../lib/image-crop'
import { Modal } from './Modal'
import { Button, ErrorText } from './ui'

const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MIN_ZOOM = 1
const MAX_ZOOM = 4

/**
 * Avatar upload module: pick or drop a photo, position it in the round frame (drag, zoom),
 * then upload a 512×512 crop.
 */
export function AvatarDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { updateUser } = useAuth()
  const queryClient = useQueryClient()
  const [source, setSource] = useState<{ url: string; img: HTMLImageElement } | null>(null)
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const pan = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)

  useEffect(() => () => {
    if (source) URL.revokeObjectURL(source.url)
  }, [source])

  const pick = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError(t('profile.avatar.notImage'))
    if (file.size > MAX_SOURCE_BYTES) return setError(t('profile.avatar.tooLarge'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setError(null)
      setCrop({ zoom: 1, x: 0, y: 0 })
      setSource({ url, img })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setError(t('profile.avatar.unreadable'))
    }
    img.src = url
  }

  const setZoom = (zoom: number) => {
    if (!source) return
    const size = { width: source.img.naturalWidth, height: source.img.naturalHeight }
    setCrop((c) => clampOffset(size, { ...c, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }))
  }

  // Wheel zoom needs a non-passive listener so the modal does not scroll instead.
  useEffect(() => {
    const el = frame.current
    if (!el || !source) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setCrop((c) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom - e.deltaY * 0.002))
        return clampOffset({ width: source.img.naturalWidth, height: source.img.naturalHeight }, { ...c, zoom })
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [source])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pan.current = { x: crop.x, y: crop.y, startX: e.clientX, startY: e.clientY }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pan.current || !source) return
    const { x, y, startX, startY } = pan.current
    setCrop((c) =>
      clampOffset(
        { width: source.img.naturalWidth, height: source.img.naturalHeight },
        { ...c, x: x + e.clientX - startX, y: y + e.clientY - startY },
      ),
    )
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files[0])
  }

  const save = async () => {
    if (!source) return
    setSaving(true)
    setError(null)
    try {
      const blob = await exportCrop(source.img, crop)
      const body = new FormData()
      body.append('file', blob, blob.type === 'image/webp' ? 'avatar.webp' : 'avatar.png')
      const user = await api<User>('/auth/me/avatar', { method: 'POST', body })
      updateUser(user)
      // Lists that show avatars.
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['players'] })
      onClose()
    } catch (err) {
      setError(errorMessage(err, t))
      setSaving(false)
    }
  }

  const size = source ? displaySize({ width: source.img.naturalWidth, height: source.img.naturalHeight }, crop.zoom) : null

  return (
    <Modal
      size="sm"
      title={t('profile.avatar.title')}
      description={source ? t('profile.avatar.cropHint') : t('profile.avatar.pickHint')}
      onClose={onClose}
      footer={
        <>
          {source && (
            <Button variant="ghost" className="mr-auto" onClick={() => fileInput.current?.click()} disabled={saving}>
              {t('profile.avatar.other')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={!source || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? t('profile.saving') : t('profile.avatar.save')}
          </Button>
        </>
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={t('profile.avatar.choose')}
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {!source ? (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          data-testid="avatar-dropzone"
          className={`flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
            dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <ImagePlus className="h-7 w-7" />
          </span>
          <span className="text-sm font-semibold text-slate-800">{t('profile.avatar.choose')}</span>
          <span className="text-xs text-slate-500">{t('profile.avatar.formats')}</span>
        </button>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div
            ref={frame}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (pan.current = null)}
            onPointerCancel={() => (pan.current = null)}
            className="relative cursor-grab touch-none overflow-hidden rounded-2xl bg-ink-900 select-none active:cursor-grabbing"
            style={{ width: CROP_FRAME, height: CROP_FRAME }}
            data-testid="avatar-cropper"
          >
            <img
              src={source.url}
              alt=""
              draggable={false}
              className="absolute max-w-none"
              style={{
                width: size!.width,
                height: size!.height,
                left: CROP_FRAME / 2 - size!.width / 2 + crop.x,
                top: CROP_FRAME / 2 - size!.height / 2 + crop.y,
              }}
            />
            {/* Round mask: everything outside the circle is dimmed. */}
            <div className="pointer-events-none absolute inset-3 rounded-full shadow-[0_0_0_999px_rgba(6,10,19,0.6)] ring-2 ring-white/80" />
            <span className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] whitespace-nowrap text-white/90">
              <Move className="h-3 w-3" />
              {t('profile.avatar.drag')}
            </span>
          </div>
          <div className="flex w-full max-w-72 items-center gap-3">
            <button type="button" onClick={() => setZoom(crop.zoom - 0.25)} className="text-slate-400 hover:text-slate-700" aria-label={t('profile.avatar.zoomOut')}>
              <ZoomOut className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={crop.zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-emerald-600"
              aria-label={t('profile.avatar.zoom')}
            />
            <button type="button" onClick={() => setZoom(crop.zoom + 0.25)} className="text-slate-400 hover:text-slate-700" aria-label={t('profile.avatar.zoomIn')}>
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </Modal>
  )
}
