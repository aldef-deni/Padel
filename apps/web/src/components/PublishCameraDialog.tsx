import { Check, Copy, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppConfig } from '../lib/queries'
import { publishUrls } from '../media/urls'
import { Modal } from './Modal'
import { Button } from './ui'

/** Camera setup info (publish URLs + recommended encoder settings), opened from a button. */
export function PublishCameraDialog({
  camera,
  courtName,
  onClose,
}: {
  camera: { name: string; streamPath: string }
  courtName: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const demo = useAppConfig().data?.demo
  const urls = publishUrls(camera.streamPath)

  return (
    <Modal
      title={t('cameras.publishTitle')}
      description={`${camera.name} · ${courtName}`}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('dashboard.close')}
        </Button>
      }
    >
      <div className="space-y-5">
        {demo && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
            {t('cameras.demoNote')}
          </p>
        )}
        <UrlRow label={t('cameras.rtmpLabel')} value={urls.rtmp} />
        <UrlRow label={t('cameras.srtLabel')} value={urls.srt} />
        <p className="text-xs text-slate-500">{t('cameras.credentialsHint')}</p>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-medium text-slate-800">{t('cameras.setupTitle')}</p>
          <ul className="space-y-1.5 text-sm text-slate-600">
            {(['setupCodec', 'setupResolution', 'setupKeyframe', 'setupBitrate'] as const).map((key) => (
              <li key={key} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {t(`cameras.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}

function UrlRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <code className="min-w-0 flex-1 font-mono text-xs break-all text-slate-700">{value}</code>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? t('cameras.copied') : t('cameras.copy')}
        </button>
      </div>
    </div>
  )
}
