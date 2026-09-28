import type { TournamentDetail, TournamentMatch, TournamentTeam } from '@padel/shared'
import {
  Ban,
  CalendarDays,
  Check,
  ChevronLeft,
  Copy,
  ExternalLink,
  GitBranch,
  ListOrdered,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  Shuffle,
  Swords,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Bracket } from '../components/tournament/Bracket'
import { MatchList } from '../components/tournament/MatchList'
import { ScheduleDialog } from '../components/tournament/ScheduleDialog'
import { ScoreDialog } from '../components/tournament/ScoreDialog'
import { StandingsTables } from '../components/tournament/StandingsTables'
import { StatusPill } from '../components/tournament/StatusPill'
import { TeamFormDialog } from '../components/tournament/TeamFormDialog'
import { TournamentFormDialog } from '../components/tournament/TournamentFormDialog'
import { Button, Card, ErrorText, Loading } from '../components/ui'
import { useTournament, useTournamentAction } from '../lib/queries'
import { formatDateRange, formatRupiah, isFinished, roundName, teamNameMap, tournamentErrorMessage } from '../lib/tournaments'

type Tab = 'overview' | 'teams' | 'matches' | 'standings' | 'bracket'

export function TournamentDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const tournament = useTournament(id!)
  if (tournament.isPending) return <Loading label={t('common.loading')} />
  if (tournament.error) return <ErrorText>{tournamentErrorMessage(tournament.error, t)}</ErrorText>
  return <TournamentView tournament={tournament.data} />
}

interface Action {
  path: string
  method: 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

function TournamentView({ tournament: x }: { tournament: TournamentDetail }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [team, setTeam] = useState<TournamentTeam | 'new' | null>(null)
  const [scoring, setScoring] = useState<TournamentMatch | null>(null)
  const [scheduling, setScheduling] = useState<TournamentMatch | null>(null)
  const action = useTournamentAction(x.id, (req, a: Action) => req(a.path, a.method, a.body))
  const remove = useTournamentAction(x.id, async (req) => {
    await req('', 'DELETE')
  })

  const tabs: { key: Tab; label: string; icon: ComponentType<{ className?: string }>; badge?: string }[] = [
    { key: 'overview', label: t('tournaments.tabs.overview'), icon: Trophy },
    { key: 'teams', label: t('tournaments.tabs.teams'), icon: Users, badge: String(x.teamCount) },
    {
      key: 'matches',
      label: t('tournaments.tabs.matches'),
      icon: Swords,
      badge: x.matchCount ? `${x.finishedMatchCount}/${x.matchCount}` : undefined,
    },
    ...(x.format !== 'SINGLE_ELIMINATION'
      ? [{ key: 'standings' as const, label: t('tournaments.tabs.standings'), icon: ListOrdered }]
      : []),
    ...(x.format !== 'ROUND_ROBIN' ? [{ key: 'bracket' as const, label: t('tournaments.tabs.bracket'), icon: GitBranch }] : []),
  ]
  const requested = params.get('tab') as Tab | null
  const tab: Tab = tabs.some((item) => item.key === requested) ? requested! : 'overview'
  const setTab = (next: Tab) => setParams(next === 'overview' ? {} : { tab: next }, { replace: true })

  const run = (a: Action, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return
    action.mutate(a)
  }
  const canScore = x.status === 'ONGOING' || x.status === 'COMPLETED'
  const onScore = canScore ? setScoring : undefined
  const onReset = canScore
    ? (m: TournamentMatch) => run({ path: `/matches/${m.id}/result`, method: 'DELETE' }, t('tournaments.matches.confirmReset'))
    : undefined
  const onDelete = () => {
    if (!window.confirm(t('tournaments.actions.confirmDelete', { name: x.name }))) return
    remove.mutate(undefined, { onSuccess: () => navigate('/tournaments', { replace: true }) })
  }

  return (
    <>
      <Link to="/tournaments" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" />
        {t('tournaments.back')}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 ring-1 ring-amber-200/70 sm:flex">
            <Trophy className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{x.name}</h1>
              <StatusPill status={x.status} />
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              {[x.category, t(`tournaments.format.${x.format}`), x.club.name].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {x.isPublic && x.status !== 'DRAFT' && (
            <a href={`/t/${x.slug}`} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="h-4 w-4" />
                {t('tournaments.info.publicLink')}
              </Button>
            </a>
          )}
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Settings className="h-4 w-4" />
            {t('tournaments.actions.edit')}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-fit">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {item.badge && (
              <span className={`rounded-md px-1.5 text-xs tabular-nums ${tab === item.key ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-500'}`}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {(action.error || remove.error) && (
        <div className="mb-5">
          <ErrorText>{tournamentErrorMessage(action.error ?? remove.error, t)}</ErrorText>
        </div>
      )}

      {tab === 'overview' && (
        <Overview tournament={x} run={run} busy={action.isPending || remove.isPending} onDelete={onDelete} onScore={onScore} />
      )}
      {tab === 'teams' && <TeamsTab tournament={x} onEdit={setTeam} run={run} />}
      {tab === 'matches' && <MatchList tournament={x} onScore={onScore} onSchedule={setScheduling} onReset={onReset} />}
      {tab === 'standings' && <StandingsTables tournament={x} />}
      {tab === 'bracket' && (
        <Card className="p-5">
          <Bracket tournament={x} onSelect={onScore} />
        </Card>
      )}

      {editing && <TournamentFormDialog clubId={x.clubId} tournament={x} onClose={() => setEditing(false)} />}
      {team && <TeamFormDialog tournament={x} team={team === 'new' ? null : team} onClose={() => setTeam(null)} />}
      {scoring && <ScoreDialog tournament={x} match={scoring} onClose={() => setScoring(null)} />}
      {scheduling && <ScheduleDialog tournament={x} match={scheduling} onClose={() => setScheduling(null)} />}
    </>
  )
}

function Overview({
  tournament: x,
  run,
  busy,
  onDelete,
  onScore,
}: {
  tournament: TournamentDetail
  run: (a: Action, confirm?: string) => void
  busy: boolean
  onDelete: () => void
  onScore?: (m: TournamentMatch) => void
}) {
  const { t, i18n } = useTranslation()
  const names = teamNameMap(x)
  const hasDraw = x.matches.length > 0
  const anyResult = x.matches.some(isFinished)
  const groupMatches = x.matches.filter((m) => m.stage === 'GROUP')
  const knockoutMatches = x.matches.filter((m) => m.stage === 'KNOCKOUT')
  const groupsDone = groupMatches.length > 0 && groupMatches.every(isFinished)
  const needsKnockout = x.format === 'GROUPS_KNOCKOUT' && x.status === 'ONGOING' && knockoutMatches.length === 0
  const final = knockoutMatches.find((m) => m.round === x.knockoutRounds && !m.isThirdPlace)
  const runnerUp =
    final?.winnerId && x.championTeamId ? (final.teamAId === x.championTeamId ? final.teamBId : final.teamAId) : null
  const champion = x.teams.find((team) => team.id === x.championTeamId)
  const upcoming = x.matches
    .filter((m) => m.status === 'SCHEDULED' && m.teamAId && m.teamBId)
    .sort((a, b) => (a.scheduledAt ?? '9').localeCompare(b.scheduledAt ?? '9') || a.round - b.round || a.position - b.position)
    .slice(0, 4)

  const step =
    x.status === 'DRAFT'
      ? t('tournaments.actions.stepDraft')
      : x.status === 'REGISTRATION'
        ? t('tournaments.actions.stepRegistration')
        : x.status === 'COMPLETED'
          ? t('tournaments.actions.stepCompleted')
          : x.status === 'CANCELLED'
            ? t('tournaments.actions.stepCancelled')
            : needsKnockout && groupsDone
              ? t('tournaments.actions.stepGroupsDone')
              : t('tournaments.actions.stepOngoing')

  const drawButton = (
    <Button
      variant={x.status === 'REGISTRATION' ? 'primary' : 'secondary'}
      disabled={busy || x.teamCount < 2}
      onClick={() => run({ path: '/draw', method: 'POST', body: { shuffle: true } }, t('tournaments.actions.confirmDraw', { count: x.teamCount }))}
    >
      <Shuffle className="h-4 w-4" />
      {t('tournaments.actions.draw')}
    </Button>
  )

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        {champion && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-6 text-white shadow-lg shadow-amber-500/20">
            <Trophy className="absolute -top-4 -right-4 h-32 w-32 text-white/15" />
            <p className="text-sm font-medium text-amber-50">{t('tournaments.actions.championTitle')}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{champion.name}</p>
            {champion.name !== `${champion.player1Name} / ${champion.player2Name}` && (
              <p className="mt-0.5 text-sm text-amber-50">
                {champion.player1Name} / {champion.player2Name}
              </p>
            )}
            {runnerUp && (
              <p className="mt-4 text-sm text-amber-50">
                {t('tournaments.actions.runnerUp')}: <strong className="text-white">{names.get(runnerUp)}</strong>
              </p>
            )}
          </div>
        )}

        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">{t('tournaments.actions.title')}</p>
          <p className="mt-1.5 text-slate-700">{step}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {x.status === 'DRAFT' && (
              <>
                <Button disabled={busy} onClick={() => run({ path: '/status', method: 'POST', body: { status: 'REGISTRATION' } })}>
                  <Users className="h-4 w-4" />
                  {t('tournaments.actions.openRegistration')}
                </Button>
                {drawButton}
              </>
            )}
            {x.status === 'REGISTRATION' && (
              <>
                {drawButton}
                <Button variant="secondary" disabled={busy} onClick={() => run({ path: '/status', method: 'POST', body: { status: 'DRAFT' } })}>
                  {t('tournaments.actions.backToDraft')}
                </Button>
              </>
            )}
            {(x.status === 'REGISTRATION' || x.status === 'DRAFT') && (
              <p className="basis-full text-xs text-slate-500">{t('tournaments.actions.drawHint')}</p>
            )}
            {needsKnockout && (
              <Button disabled={busy || !groupsDone} onClick={() => run({ path: '/knockout', method: 'POST' })}>
                <GitBranch className="h-4 w-4" />
                {t('tournaments.actions.knockout')}
              </Button>
            )}
            {x.format === 'GROUPS_KNOCKOUT' && knockoutMatches.length > 0 && !knockoutMatches.some(isFinished) && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => run({ path: '/knockout', method: 'DELETE' }, t('tournaments.actions.confirmResetKnockout'))}
              >
                <RotateCcw className="h-4 w-4" />
                {t('tournaments.actions.resetKnockout')}
              </Button>
            )}
            {x.status === 'ONGOING' && !anyResult && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => run({ path: '/draw', method: 'DELETE' }, t('tournaments.actions.confirmResetDraw'))}
              >
                <RotateCcw className="h-4 w-4" />
                {t('tournaments.actions.resetDraw')}
              </Button>
            )}
            {x.status === 'CANCELLED' && !hasDraw && (
              <Button variant="secondary" disabled={busy} onClick={() => run({ path: '/status', method: 'POST', body: { status: 'DRAFT' } })}>
                <RotateCcw className="h-4 w-4" />
                {t('tournaments.actions.reopen')}
              </Button>
            )}
          </div>
        </Card>

        {x.status === 'ONGOING' && (
          <Card className="p-5">
            <p className="mb-3 font-semibold text-slate-900">{t('tournaments.actions.upcoming')}</p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">{t('tournaments.actions.noUpcoming')}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcoming.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={!onScore}
                      onClick={() => onScore?.(m)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm enabled:hover:bg-slate-50"
                    >
                      <span className="w-32 shrink-0 text-xs text-slate-500">
                        {m.stage === 'GROUP'
                          ? t('tournaments.matches.groupRound', { group: x.groups.find((g) => g.id === m.groupId)?.name, round: m.round })
                          : roundName(m, x.knockoutRounds, t)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                        {names.get(m.teamAId!)} <span className="font-normal text-slate-400">vs</span> {names.get(m.teamBId!)}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {[
                          m.court?.name,
                          m.scheduledAt &&
                            new Date(m.scheduledAt).toLocaleString(i18n.language, {
                              weekday: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            }),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card className="divide-y divide-slate-100">
          <InfoRow icon={CalendarDays} label={t('tournaments.info.dates')}>
            {formatDateRange(x.startDate, x.endDate, i18n.language)}
          </InfoRow>
          {x.registrationDeadline && (
            <InfoRow label={t('tournaments.info.deadline')}>
              {new Date(x.registrationDeadline).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}
            </InfoRow>
          )}
          <InfoRow label={t('tournaments.info.teams')}>
            {x.teamCount}
            {x.maxTeams ? ` / ${x.maxTeams}` : ''}
          </InfoRow>
          {x.matchCount > 0 && (
            <InfoRow label={t('tournaments.info.matches')}>
              {t('tournaments.progress', { done: x.finishedMatchCount, total: x.matchCount })}
            </InfoRow>
          )}
          <InfoRow label={t('tournaments.info.format')}>{t(`tournaments.format.${x.format}`)}</InfoRow>
          <InfoRow label={t('tournaments.info.scoring')}>
            {t('tournaments.info.scoringText', {
              sets: x.setsToWin === 1 ? t('tournaments.form.oneSet') : t('tournaments.form.bestOf3'),
              games: x.gamesPerSet,
              stb: x.setsToWin > 1 && x.superTiebreak ? t('tournaments.info.stb') : '',
              gp: x.goldenPoint ? t('tournaments.info.gp') : '',
            })}
          </InfoRow>
          <InfoRow label={t('tournaments.info.fee')}>
            {x.entryFee ? formatRupiah(x.entryFee, i18n.language) : t('tournaments.info.free')}
          </InfoRow>
          {x.prizeInfo && <InfoRow label={t('tournaments.info.prize')}>{x.prizeInfo}</InfoRow>}
          <InfoRow label={t('tournaments.info.publicLink')}>
            {x.isPublic ? <PublicLink slug={x.slug} /> : <span className="text-slate-500">{t('tournaments.info.notPublic')}</span>}
          </InfoRow>
        </Card>
        {x.description && (
          <Card className="p-5">
            <p className="text-sm whitespace-pre-line text-slate-600">{x.description}</p>
          </Card>
        )}

        {x.status !== 'COMPLETED' && (
          <Card className="p-5">
            <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{t('tournaments.actions.danger')}</p>
            <div className="flex flex-wrap gap-2">
              {x.status !== 'CANCELLED' && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => run({ path: '/status', method: 'POST', body: { status: 'CANCELLED' } }, t('tournaments.actions.confirmCancel'))}
                >
                  <Ban className="h-4 w-4" />
                  {t('tournaments.actions.cancel')}
                </Button>
              )}
              {x.status !== 'ONGOING' && (
                <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                  {t('tournaments.actions.delete')}
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, children }: { icon?: ComponentType<{ className?: string }>; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
      <span className="flex shrink-0 items-center gap-1.5 text-slate-500">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        {label}
      </span>
      <span className="min-w-0 text-right font-medium text-slate-800">{children}</span>
    </div>
  )
}

function PublicLink({ slug }: { slug: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/t/${slug}`
  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <span className="inline-flex items-center gap-1">
      <a href={url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
        {t('tournaments.info.open')}
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label={t('tournaments.info.copy')}
        title={copied ? t('tournaments.info.copied') : t('tournaments.info.copy')}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}

function TeamsTab({
  tournament: x,
  onEdit,
  run,
}: {
  tournament: TournamentDetail
  onEdit: (team: TournamentTeam | 'new') => void
  run: (a: Action, confirm?: string) => void
}) {
  const { t } = useTranslation()
  const rosterOpen = x.status === 'DRAFT' || x.status === 'REGISTRATION'
  const groupName = new Map(x.groups.map((g) => [g.id, g.name]))
  const teams = [...x.teams].sort(
    (a, b) =>
      Number(a.status === 'WITHDRAWN') - Number(b.status === 'WITHDRAWN') ||
      (a.seed ?? Infinity) - (b.seed ?? Infinity) ||
      a.name.localeCompare(b.name),
  )
  const full = !!x.maxTeams && x.teamCount >= x.maxTeams

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{rosterOpen ? t('tournaments.teams.withdrawnNote') : t('tournaments.teams.locked')}</p>
        {rosterOpen && (
          <Button onClick={() => onEdit('new')} disabled={full} title={full ? t('tournaments.errors.full') : undefined}>
            <Plus className="h-4 w-4" />
            {t('tournaments.teams.add')}
          </Button>
        )}
      </div>
      <Card className="overflow-hidden">
        {teams.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-slate-500">{t('tournaments.teams.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <th className="w-16 px-5 py-3">Seed</th>
                  <th className="px-3 py-3">{t('tournaments.teams.name')}</th>
                  {x.groups.length > 1 && <th className="px-3 py-3">{t('tournaments.teams.group')}</th>}
                  <th className="px-3 py-3">{t('tournaments.teams.status')}</th>
                  <th className="px-3 py-3">{t('tournaments.teams.payment')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teams.map((team) => (
                  <tr key={team.id} className={team.status === 'WITHDRAWN' ? 'opacity-50' : ''}>
                    <td className="px-5 py-3 text-slate-500 tabular-nums">{team.seed ?? '–'}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{team.name}</p>
                      <p className="text-xs text-slate-500">
                        {team.player1Name} / {team.player2Name}
                        {(team.player1Id || team.player2Id) && (
                          <span className="ml-1.5 rounded bg-emerald-50 px-1 text-[10px] font-medium text-emerald-700">
                            {t('tournaments.teams.linked')}
                          </span>
                        )}
                      </p>
                      {team.note && <p className="mt-0.5 text-xs text-slate-400 italic">{team.note}</p>}
                    </td>
                    {x.groups.length > 1 && <td className="px-3 py-3">{team.groupId ? groupName.get(team.groupId) : '–'}</td>}
                    <td className="px-3 py-3 text-slate-600">{t(`tournaments.teams.statusLabel.${team.status}`)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          team.paid ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                        }`}
                      >
                        {team.paid ? t('tournaments.teams.paid') : t('tournaments.teams.unpaid')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(team)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={t('tournaments.teams.edit')}
                          title={t('tournaments.teams.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {rosterOpen && (
                          <button
                            type="button"
                            onClick={() =>
                              run({ path: `/teams/${team.id}`, method: 'DELETE' }, t('tournaments.teams.confirmDelete', { name: team.name }))
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label={t('tournaments.teams.delete')}
                            title={t('tournaments.teams.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
