import { useTranslation } from 'react-i18next'
import type { CameraState } from '../lib/camera-state'

const styles: Record<CameraState, { pill: string; dot: string }> = {
  online: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500 animate-pulse' },
  offline: { pill: 'bg-slate-100 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400' },
  inactive: { pill: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-400' },
  unknown: { pill: 'bg-slate-50 text-slate-500 ring-slate-400/20', dot: 'bg-slate-300' },
}

export function StatusBadge({ state }: { state: CameraState }) {
  const { t } = useTranslation()
  const style = styles[state]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {t(`status.${state}`)}
    </span>
  )
}
