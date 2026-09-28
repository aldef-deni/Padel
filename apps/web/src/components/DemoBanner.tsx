import { FlaskConical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppConfig } from '../lib/queries'

/** Strip shown on the demo instance only: explains that data resets daily, with a countdown. */
export function DemoBanner() {
  const { t } = useTranslation()
  const config = useAppConfig()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const demo = config.data?.demo
  if (!demo) return null
  const minutes = Math.max(0, Math.round((new Date(demo.resetAt).getTime() - now) / 60_000))
  const left = t('demo.duration', { h: Math.floor(minutes / 60), m: minutes % 60 })
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-6 lg:px-10">
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-amber-950">
        <FlaskConical className="h-3.5 w-3.5" />
        {t('demo.badge')}
      </span>
      <span>{t('demo.banner', { left })}</span>
    </div>
  )
}
