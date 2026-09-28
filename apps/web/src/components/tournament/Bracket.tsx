import type { TournamentDetail, TournamentMatch } from '@padel/shared'
import { Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { roundName, teamNameMap } from '../../lib/tournaments'

/**
 * Knockout bracket: one column per round, pairs joined by connector lines.
 * `onSelect` makes matches clickable (admin score entry).
 */
export function Bracket({
  tournament,
  onSelect,
}: {
  tournament: TournamentDetail
  onSelect?: (match: TournamentMatch) => void
}) {
  const { t } = useTranslation()
  const knockout = tournament.matches.filter((m) => m.stage === 'KNOCKOUT')
  const rounds = tournament.knockoutRounds
  if (!rounds) return <p className="py-10 text-center text-sm text-slate-500">{t('tournaments.bracket.empty')}</p>

  const third = knockout.find((m) => m.isThirdPlace)
  const columns = Array.from({ length: rounds }, (_, i) =>
    knockout.filter((m) => m.round === i + 1 && !m.isThirdPlace).sort((a, b) => a.position - b.position),
  )
  const firstRound = columns[0].length
  // Enough height for the first round; later rounds centre between their feeders.
  const height = Math.max(firstRound * 104, 220)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-10">
        {columns.map((matches, i) => (
          <div key={i} className="w-60 shrink-0">
            <p className="mb-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {roundName({ round: i + 1, isThirdPlace: false }, rounds, t)}
            </p>
            <div className="flex flex-col justify-around" style={{ height }}>
              {pairUp(matches).map((pair, p) => (
                <div
                  key={p}
                  className={`relative flex flex-1 flex-col justify-around ${
                    i < rounds - 1 && pair.length === 2
                      ? 'after:pointer-events-none after:absolute after:top-1/4 after:-right-5 after:bottom-1/4 after:w-5 after:rounded-r-lg after:border-y-2 after:border-r-2 after:border-slate-200'
                      : ''
                  }`}
                >
                  {pair.map((m) => (
                    <div key={m.id} className={`relative ${i > 0 ? 'before:absolute before:top-1/2 before:-left-5 before:w-5 before:border-t-2 before:border-slate-200' : ''}`}>
                      <MatchCard tournament={tournament} match={m} onSelect={onSelect} highlightChampion={i === rounds - 1} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {third && (
        <div className="mt-8 w-60">
          <p className="mb-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {roundName(third, rounds, t)}
          </p>
          <MatchCard tournament={tournament} match={third} onSelect={onSelect} />
        </div>
      )}
    </div>
  )
}

function pairUp<T>(items: T[]): T[][] {
  const pairs: T[][] = []
  for (let i = 0; i < items.length; i += 2) pairs.push(items.slice(i, i + 2))
  return pairs
}

export function MatchCard({
  tournament,
  match,
  onSelect,
  highlightChampion = false,
}: {
  tournament: TournamentDetail
  match: TournamentMatch
  onSelect?: (match: TournamentMatch) => void
  highlightChampion?: boolean
}) {
  const { t } = useTranslation()
  const names = teamNameMap(tournament)
  const seeds = new Map(tournament.teams.map((x) => [x.id, x.seed]))
  const clickable = !!onSelect && match.status !== 'BYE' && !!match.teamAId && !!match.teamBId

  const row = (side: 'A' | 'B') => {
    const id = side === 'A' ? match.teamAId : match.teamBId
    const won = !!match.winnerId && match.winnerId === id
    const lost = !!match.winnerId && !won
    const champion = highlightChampion && won && !match.isThirdPlace
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${champion ? 'bg-amber-50' : won ? 'bg-emerald-50/70' : ''}`}>
        <span className="w-4 shrink-0 text-right text-[10px] text-slate-400 tabular-nums">{id ? (seeds.get(id) ?? '') : ''}</span>
        <span
          className={`min-w-0 flex-1 truncate text-sm ${won ? 'font-semibold text-slate-900' : lost ? 'text-slate-400' : id ? 'text-slate-700' : 'text-slate-300 italic'}`}
        >
          {id ? names.get(id) : match.status === 'BYE' ? t('tournaments.matches.bye') : t('tournaments.matches.tbd')}
        </span>
        {champion && <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        <span className="flex shrink-0 gap-1.5 font-mono text-xs tabular-nums">
          {match.status === 'WALKOVER'
            ? won && <span className="font-semibold text-emerald-700">{t('tournaments.matches.walkover')}</span>
            : match.sets?.map((s, i) => {
                const mine = side === 'A' ? s.a : s.b
                const theirs = side === 'A' ? s.b : s.a
                return (
                  <span key={i} className={mine > theirs ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                    {mine}
                  </span>
                )
              })}
        </span>
      </div>
    )
  }

  const body = (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        match.status === 'BYE' ? 'border-dashed border-slate-200 opacity-70' : 'border-slate-200'
      } ${clickable ? 'hover:border-emerald-400 hover:shadow-md' : ''}`}
    >
      {row('A')}
      <div className="border-t border-slate-100" />
      {row('B')}
      {(match.court || match.scheduledAt) && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-1 text-[10px] text-slate-500">
          {[
            match.court?.name,
            match.scheduledAt &&
              new Date(match.scheduledAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
    </div>
  )
  return clickable ? (
    <button type="button" onClick={() => onSelect!(match)} className="block w-full text-left" data-match-id={match.id}>
      {body}
    </button>
  ) : (
    <div data-match-id={match.id}>{body}</div>
  )
}
