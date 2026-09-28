import type { TournamentDetail, TournamentMatch } from '@padel/shared'
import { CalendarClock, Pencil, RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isFinished, roundName } from '../../lib/tournaments'
import { Card } from '../ui'
import { MatchCard } from './Bracket'

type Filter = 'ALL' | 'OPEN' | 'DONE'

/** Matches grouped by stage/round, with admin actions when handlers are given. */
export function MatchList({
  tournament,
  onScore,
  onSchedule,
  onReset,
}: {
  tournament: TournamentDetail
  onScore?: (match: TournamentMatch) => void
  onSchedule?: (match: TournamentMatch) => void
  onReset?: (match: TournamentMatch) => void
}) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('ALL')
  const visible = tournament.matches.filter(
    (m) => m.status !== 'BYE' && (filter === 'ALL' || (filter === 'DONE') === isFinished(m)),
  )
  if (!tournament.matches.length) return <p className="py-10 text-center text-sm text-slate-500">{t('tournaments.matches.empty')}</p>

  const groupName = new Map(tournament.groups.map((g) => [g.id, g.name]))
  const sections = new Map<string, TournamentMatch[]>()
  for (const m of visible) {
    const key =
      m.stage === 'GROUP'
        ? tournament.groups.length > 1
          ? t('tournaments.matches.groupRound', { group: groupName.get(m.groupId!), round: m.round })
          : t('tournaments.rounds.round', { n: m.round })
        : roundName(m, tournament.knockoutRounds, t)
    sections.set(key, [...(sections.get(key) ?? []), m])
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 sm:w-fit">
        {(['ALL', 'OPEN', 'DONE'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {t(`tournaments.matches.filter${f === 'ALL' ? 'All' : f === 'OPEN' ? 'Open' : 'Done'}`)}
          </button>
        ))}
      </div>
      {[...sections.entries()].map(([title, matches]) => (
        <section key={title}>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matches.map((m) => (
              <Card key={m.id} className="p-2">
                <MatchCard tournament={tournament} match={m} onSelect={onScore} />
                {(onScore || onSchedule) && (
                  <div className="mt-2 flex flex-wrap gap-1 px-1">
                    {onSchedule && (
                      <ActionButton onClick={() => onSchedule(m)} icon={<CalendarClock className="h-3.5 w-3.5" />}>
                        {t('tournaments.matches.schedule')}
                      </ActionButton>
                    )}
                    {onScore && m.teamAId && m.teamBId && (
                      <ActionButton onClick={() => onScore(m)} icon={<Pencil className="h-3.5 w-3.5" />}>
                        {isFinished(m) ? t('tournaments.matches.editScore') : t('tournaments.matches.score')}
                      </ActionButton>
                    )}
                    {onReset && isFinished(m) && (
                      <ActionButton onClick={() => onReset(m)} icon={<RotateCcw className="h-3.5 w-3.5" />} danger>
                        {t('tournaments.matches.reset')}
                      </ActionButton>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ActionButton({
  onClick,
  icon,
  danger,
  children,
}: {
  onClick: () => void
  icon: ReactNode
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
        danger ? 'text-slate-500 hover:bg-red-50 hover:text-red-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
