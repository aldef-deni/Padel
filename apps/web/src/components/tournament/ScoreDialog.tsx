import type { SetScore, TournamentDetail, TournamentMatch } from '@padel/shared'
import { Minus, Plus, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTournamentAction } from '../../lib/queries'
import { teamNameMap, tournamentErrorMessage } from '../../lib/tournaments'
import { Modal } from '../Modal'
import { Button, ErrorText } from '../ui'

/** Score entry: set by set (super tie-break for the decider) or a walkover. */
export function ScoreDialog({
  tournament,
  match,
  onClose,
}: {
  tournament: TournamentDetail
  match: TournamentMatch
  onClose: () => void
}) {
  const { t } = useTranslation()
  const names = teamNameMap(tournament)
  const maxSets = tournament.setsToWin * 2 - 1
  const [sets, setSets] = useState<{ a: string; b: string }[]>(
    match.sets?.map((s) => ({ a: String(s.a), b: String(s.b) })) ??
      Array.from({ length: tournament.setsToWin }, () => ({ a: '', b: '' })),
  )
  const [walkover, setWalkover] = useState<'A' | 'B' | null>(match.status === 'WALKOVER' ? (match.winnerId === match.teamAId ? 'A' : 'B') : null)
  const save = useTournamentAction(tournament.id, (req, body: { sets?: SetScore[]; walkover?: 'A' | 'B' }) =>
    req(`/matches/${match.id}/result`, 'POST', body),
  )

  const filled = sets.filter((s) => s.a !== '' && s.b !== '').map((s) => ({ a: Number(s.a), b: Number(s.b) }))
  const won = filled.reduce((acc, s) => [acc[0] + (s.a > s.b ? 1 : 0), acc[1] + (s.b > s.a ? 1 : 0)], [0, 0])
  const preview = walkover ?? (won[0] === tournament.setsToWin ? 'A' : won[1] === tournament.setsToWin ? 'B' : null)
  const isDecider = (i: number) => tournament.setsToWin === 2 && tournament.superTiebreak && i === 2

  const submit = () => save.mutate(walkover ? { walkover } : { sets: filled }, { onSuccess: onClose })

  return (
    <Modal
      title={t('tournaments.matches.scoreTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={save.isPending || (!walkover && filled.length === 0)}>
            {save.isPending ? t('tournaments.form.saving') : t('tournaments.matches.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[1fr_repeat(var(--sets),4rem)] items-center gap-2 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500" style={{ ['--sets' as string]: sets.length }}>
            <span />
            {sets.map((_, i) => (
              <span key={i} className="text-center">
                {isDecider(i) ? 'STB' : t('tournaments.matches.set', { n: i + 1 })}
              </span>
            ))}
          </div>
          {(['a', 'b'] as const).map((side) => {
            const id = side === 'a' ? match.teamAId : match.teamBId
            const isWinner = preview === side.toUpperCase()
            return (
              <div
                key={side}
                className="grid grid-cols-[1fr_repeat(var(--sets),4rem)] items-center gap-2 border-t border-slate-100 px-4 py-3"
                style={{ ['--sets' as string]: sets.length }}
              >
                <span className={`flex min-w-0 items-center gap-2 truncate text-sm ${isWinner ? 'font-semibold text-emerald-700' : 'text-slate-800'}`}>
                  {isWinner && <Trophy className="h-4 w-4 shrink-0" />}
                  {names.get(id ?? '') ?? '—'}
                </span>
                {sets.map((s, i) => (
                  <input
                    key={i}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    disabled={!!walkover}
                    aria-label={`${names.get(id ?? '')} ${t('tournaments.matches.set', { n: i + 1 })}`}
                    value={s[side]}
                    onChange={(e) => setSets((all) => all.map((x, j) => (j === i ? { ...x, [side]: e.target.value } : x)))}
                    className="h-10 w-full rounded-lg border border-slate-200 text-center text-base font-semibold tabular-nums outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-50"
                  />
                ))}
              </div>
            )
          })}
        </div>
        <div className="flex gap-2">
          {sets.length < maxSets && (
            <Button variant="secondary" size="sm" disabled={!!walkover} onClick={() => setSets((s) => [...s, { a: '', b: '' }])}>
              <Plus className="h-3.5 w-3.5" />
              {t('tournaments.matches.addSet')}
            </Button>
          )}
          {sets.length > 1 && (
            <Button variant="ghost" size="sm" disabled={!!walkover} onClick={() => setSets((s) => s.slice(0, -1))}>
              <Minus className="h-3.5 w-3.5" />
              {t('tournaments.matches.removeSet')}
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-3.5">
          <p className="text-sm font-medium text-slate-800">{t('tournaments.matches.walkoverFor')}</p>
          <p className="mb-2 text-xs text-slate-500">{t('tournaments.matches.walkoverHint')}</p>
          <div className="flex flex-wrap gap-2">
            {(['A', 'B'] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => setWalkover(walkover === side ? null : side)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  walkover === side ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {names.get((side === 'A' ? match.teamAId : match.teamBId) ?? '')}
              </button>
            ))}
          </div>
        </div>
        {save.error && <ErrorText>{tournamentErrorMessage(save.error, t)}</ErrorText>}
      </div>
    </Modal>
  )
}
