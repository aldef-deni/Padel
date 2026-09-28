import type { TournamentDetail } from '@padel/shared'
import { useTranslation } from 'react-i18next'
import { teamNameMap } from '../../lib/tournaments'
import { Card } from '../ui'

export function StandingsTables({ tournament }: { tournament: TournamentDetail }) {
  const { t } = useTranslation()
  const names = teamNameMap(tournament)
  if (!tournament.groups.length) {
    return <p className="py-10 text-center text-sm text-slate-500">{t('tournaments.standings.empty')}</p>
  }
  const advance = tournament.format === 'GROUPS_KNOCKOUT' ? tournament.advancePerGroup : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        {tournament.groups.map((group) => (
          <Card key={group.id} className="overflow-hidden">
            {tournament.groups.length > 1 && (
              <p className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
                {t('tournaments.teams.group')} {group.name}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="w-10 px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">{t('tournaments.standings.team')}</th>
                    <th className="px-2 py-2 text-center">{t('tournaments.standings.played')}</th>
                    <th className="px-2 py-2 text-center">{t('tournaments.standings.won')}</th>
                    <th className="px-2 py-2 text-center">{t('tournaments.standings.lost')}</th>
                    <th className="px-2 py-2 text-center">{t('tournaments.standings.sets')}</th>
                    <th className="px-2 py-2 text-center">{t('tournaments.standings.games')}</th>
                    <th className="px-3 py-2 text-center">{t('tournaments.standings.points')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.standings.map((row, i) => {
                    const qualifies = i < advance
                    return (
                      <tr key={row.teamId} className={qualifies ? 'bg-emerald-50/40' : ''}>
                        <td className="px-3 py-2.5">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                              qualifies ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="max-w-48 truncate px-3 py-2.5 font-medium text-slate-900">{names.get(row.teamId)}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{row.played}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{row.won}</td>
                        <td className="px-2 py-2.5 text-center tabular-nums">{row.lost}</td>
                        <td className="px-2 py-2.5 text-center text-slate-600 tabular-nums">
                          {row.setsWon}-{row.setsLost}
                        </td>
                        <td className="px-2 py-2.5 text-center text-slate-600 tabular-nums">
                          {row.gamesWon}-{row.gamesLost}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold tabular-nums">{row.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {t('tournaments.standings.legend')}
        {advance > 0 && (
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> {t('tournaments.standings.qualifies')}
          </span>
        )}
      </p>
    </div>
  )
}
