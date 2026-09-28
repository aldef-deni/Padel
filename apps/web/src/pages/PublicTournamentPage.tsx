import type { TournamentDetail } from '@padel/shared'
import { CalendarDays, GitBranch, ListOrdered, RefreshCw, Swords, Trophy, Users } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { BrandMark } from '../components/brand'
import { ClubAvatar } from '../components/ClubAvatar'
import { Bracket } from '../components/tournament/Bracket'
import { MatchList } from '../components/tournament/MatchList'
import { StandingsTables } from '../components/tournament/StandingsTables'
import { StatusPill } from '../components/tournament/StatusPill'
import { Card, Loading } from '../components/ui'
import { ApiRequestError } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { usePublicTournament } from '../lib/queries'
import { formatDateRange, formatRupiah } from '../lib/tournaments'

type Tab = 'bracket' | 'standings' | 'schedule' | 'teams'

/** Read-only tournament page for players and spectators: /t/:slug, no login. */
export function PublicTournamentPage() {
  const { t } = useTranslation()
  const { slug = '' } = useParams()
  const tournament = usePublicTournament(slug)

  return (
    <div className="min-h-screen bg-slate-50">
      {tournament.data ? (
        <PublicView tournament={tournament.data} />
      ) : tournament.error ? (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <Trophy className="h-10 w-10 text-slate-300" />
          <p className="text-slate-600">
            {tournament.error instanceof ApiRequestError && tournament.error.status === 404
              ? t('tournaments.public.notFound')
              : errorMessage(tournament.error, t)}
          </p>
        </div>
      ) : (
        <div className="flex min-h-screen items-center justify-center">
          <Loading label={t('common.loading')} />
        </div>
      )}
    </div>
  )
}

function PublicView({ tournament: x }: { tournament: TournamentDetail }) {
  const { t, i18n } = useTranslation()
  const hasStandings = x.format !== 'SINGLE_ELIMINATION' && x.groups.length > 0
  const hasBracket = x.format !== 'ROUND_ROBIN' && x.knockoutRounds > 0
  const tabs: { key: Tab; label: string; icon: ComponentType<{ className?: string }> }[] = [
    ...(hasBracket ? [{ key: 'bracket' as const, label: t('tournaments.tabs.bracket'), icon: GitBranch }] : []),
    ...(hasStandings ? [{ key: 'standings' as const, label: t('tournaments.tabs.standings'), icon: ListOrdered }] : []),
    ...(x.matches.length ? [{ key: 'schedule' as const, label: t('tournaments.public.schedule'), icon: Swords }] : []),
    { key: 'teams', label: t('tournaments.tabs.teams'), icon: Users },
  ]
  const [picked, setPicked] = useState<Tab | null>(null)
  const tab = picked && tabs.some((item) => item.key === picked) ? picked : tabs[0].key
  const champion = x.teams.find((team) => team.id === x.championTeamId)
  const teams = x.teams.filter((team) => team.status !== 'WITHDRAWN')

  return (
    <>
      <header className="relative overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.25),transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6">
          <div className="flex items-center gap-3">
            <ClubAvatar club={x.club} className="h-11 w-11 text-sm" />
            <span className="font-medium text-slate-300">{x.club.name}</span>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{x.name}</h1>
            <StatusPill status={x.status} />
          </div>
          <p className="mt-2 text-slate-400">
            {[x.category, t(`tournaments.format.${x.format}`)].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-emerald-400" />
              {formatDateRange(x.startDate, x.endDate, i18n.language)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-400" />
              {t('tournaments.teams', { count: x.teamCount })}
            </span>
            {x.entryFee ? <span>{formatRupiah(x.entryFee, i18n.language)}</span> : null}
            {x.prizeInfo && (
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-amber-400" />
                {x.prizeInfo}
              </span>
            )}
          </div>
          {champion && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 shadow-lg shadow-amber-500/20">
              <Trophy className="h-6 w-6" />
              <div>
                <p className="text-xs font-medium text-amber-50">{t('tournaments.actions.championTitle')}</p>
                <p className="font-bold">{champion.name}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPicked(item.key)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
          {x.status === 'ONGOING' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <RefreshCw className="h-3.5 w-3.5" />
              {t('tournaments.public.autoRefresh')}
            </span>
          )}
        </div>

        {x.description && tab === tabs[0].key && (
          <p className="mb-6 max-w-3xl text-sm whitespace-pre-line text-slate-600">{x.description}</p>
        )}

        {tab === 'bracket' && (
          <Card className="p-5">
            <Bracket tournament={x} />
          </Card>
        )}
        {tab === 'standings' && <StandingsTables tournament={x} />}
        {tab === 'schedule' && <MatchList tournament={x} />}
        {tab === 'teams' &&
          (teams.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">{t('tournaments.teams.empty')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <Card key={team.id} className="flex items-center gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                    {team.seed ?? <Users className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{team.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {team.player1Name} / {team.player2Name}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          ))}

        <footer className="mt-12 flex items-center justify-center gap-2 text-xs text-slate-400">
          <BrandMark className="h-5 w-5" />
          {t('tournaments.public.poweredBy')}
        </footer>
      </main>
    </>
  )
}
