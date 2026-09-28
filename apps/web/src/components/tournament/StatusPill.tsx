import type { TournamentStatus } from '@padel/shared'
import { useTranslation } from 'react-i18next'
import { STATUS_STYLE } from '../../lib/tournaments'

export function StatusPill({ status }: { status: TournamentStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {t(`tournaments.status.${status}`)}
    </span>
  )
}
