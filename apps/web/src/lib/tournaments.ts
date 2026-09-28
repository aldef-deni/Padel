import type { SetScore, TournamentDetail, TournamentMatch, TournamentStatus } from '@padel/shared'
import type { TFunction } from 'i18next'
import { ApiRequestError } from './api'
import { errorMessage } from './errors'

export const STATUS_STYLE: Record<TournamentStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  REGISTRATION: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  ONGOING: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  COMPLETED: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  CANCELLED: 'bg-red-50 text-red-600 ring-red-600/20',
}

/** "Final", "Semifinal", "Round of 16", … for knockout round `round` of `total`. */
export function roundName(match: Pick<TournamentMatch, 'round' | 'isThirdPlace'>, total: number, t: TFunction) {
  if (match.isThirdPlace) return t('tournaments.rounds.third')
  const fromEnd = total - match.round
  if (fromEnd === 0) return t('tournaments.rounds.final')
  if (fromEnd === 1) return t('tournaments.rounds.semi')
  if (fromEnd === 2) return t('tournaments.rounds.quarter')
  return t('tournaments.rounds.roundOf', { n: 2 ** (fromEnd + 1) })
}

/** "6-4 3-6 10-8" from team A's perspective. */
export function formatSets(sets: SetScore[] | null): string {
  return sets?.map((s) => `${s.a}-${s.b}`).join('  ') ?? ''
}

export function teamNameMap(t: TournamentDetail) {
  return new Map(t.teams.map((team) => [team.id, team.name]))
}

export function isFinished(m: Pick<TournamentMatch, 'status'>) {
  return m.status === 'COMPLETED' || m.status === 'WALKOVER'
}

export function formatDateRange(start: string, end: string | null, lang: string) {
  const f = (iso: string) => new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })
  return end && end.slice(0, 10) !== start.slice(0, 10) ? `${f(start)} – ${f(end)}` : f(start)
}

export function formatRupiah(value: number, lang: string) {
  return new Intl.NumberFormat(lang, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

/** Maps tournament API errors to UI text. */
export function tournamentErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiRequestError) {
    const m = error.message
    if (error.status === 409) {
      if (/Reset the draw before changing/i.test(m)) return t('tournaments.errors.locked')
      if (/is full/i.test(m)) return t('tournaments.errors.full')
      if (/locked once the tournament/i.test(m)) return t('tournaments.errors.rosterLocked')
      if (/next match already has a result/i.test(m)) return t('tournaments.errors.nextPlayed')
      if (/knockout was built/i.test(m)) return t('tournaments.errors.knockoutExists')
      if (/group match\(es\) still need/i.test(m)) return t('tournaments.errors.groupsOpen')
      if (/cannot be deleted/i.test(m)) return t('tournaments.errors.cannotDelete')
      if (/results have been entered/i.test(m)) return t('tournaments.errors.resultsExist')
      if (/unique value/i.test(m)) return t('tournaments.errors.teamName')
    }
    if (error.status === 400) {
      if (/teams|need at least|can advance|must advance/i.test(m)) return `${t('tournaments.errors.notEnough')} (${m})`
      const reason = scoreReason(m, t)
      if (reason) return reason
    }
  }
  return errorMessage(error, t)
}

/** Translates the API's score validation reasons (see evaluateSets in the API). */
function scoreReason(m: string, t: TFunction): string | null {
  let x: RegExpMatchArray | null
  if ((x = m.match(/A match has 1 to (\d+) sets/))) return t('tournaments.errors.score.setCount', { max: x[1] })
  if (/already decided before this set/.test(m)) return t('tournaments.errors.score.decided')
  if ((x = m.match(/Set (\d+) must have a winner/))) return t('tournaments.errors.score.noWinner', { n: x[1] })
  if ((x = m.match(/Set (\d+) \(super tie-break\)/))) return t('tournaments.errors.score.stb', { n: x[1] })
  if ((x = m.match(/Set (\d+) score (\d+-\d+) is not a valid set to (\d+)/)))
    return t('tournaments.errors.score.invalidSet', { n: x[1], score: x[2], games: x[3] })
  if (/not finished yet/.test(m)) return t('tournaments.errors.score.unfinished')
  return null
}
