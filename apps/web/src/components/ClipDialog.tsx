import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/** Modal video player for a READY clip (native <dialog>: Esc and backdrop close it). */
export function ClipDialog({
  src,
  title,
  subtitle,
  onClose,
}: {
  src: string
  title: string
  subtitle?: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
      className="m-auto w-[min(960px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-ink-950 p-0 text-white shadow-2xl backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3.5">
        <div className="min-w-0">
          <p className="truncate font-semibold">{title}</p>
          {subtitle && <p className="truncate text-sm text-slate-400">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label={t('dashboard.close')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <video src={src} controls autoPlay playsInline className="aspect-video w-full bg-black" />
    </dialog>
  )
}
