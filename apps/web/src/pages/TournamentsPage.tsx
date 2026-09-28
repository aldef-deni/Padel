import type { TournamentStatus, TournamentSummary } from '@padel/shared'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Search, Trophy, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { StatusPill } from '../components/tournament/StatusPill'
import { TournamentFormDialog } from '../components/tournament/TournamentFormDialog'
import { Button, Card, EmptyState, ErrorText, Input, Loading, PageHeader } from '../components/ui'
import { useTournaments } from '../lib/queries'
import { formatDateRange, tournamentErrorMessage } from '../lib/tournaments'
import { useClub } from '../lib/use-club'

const PAGE_SIZE = 12
type Tab = TournamentStatus | 'ALL'
const TABS: Tab[] = ['ALL', 'REGISTRATION', 'ONGOING', 'COMPLETED', 'DRAFT', 'CANCELLED']

export function TournamentsPage() {
  const { t } = useTranslation()
  const club = useClub()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Tab>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const list = useTournaments({
    clubId: club.id,
    status: status === 'ALL' ? undefined : status,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  })
  const data = list.data

  return (
    <>
      <PageHeader
        title={t('tournaments.title')}
        description={t('tournaments.description', { club: club.name })}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t('tournaments.add')}
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setStatus(tab)
                setPage(1)
              }}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                status === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'ALL' ? t('tournaments.all') : t(`tournaments.status.${tab}`)}
              <span
                className={`rounded-md px-1.5 text-xs tabular-nums ${status === tab ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-500'}`}
              >
                {data?.counts[tab] ?? '·'}
              </span>
            </button>
          ))}
        </div>
        <div className="w-full lg:w-80">
          <Input icon={Search} type="search" placeholder={t('tournaments.search')} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
      </div>

      {list.isPending ? (
        <Loading label={t('common.loading')} />
      ) : list.error ? (
        <ErrorText>{tournamentErrorMessage(list.error, t)}</ErrorText>
      ) : data!.items.length === 0 ? (
        <EmptyState>
          <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          {t('tournaments.empty')}
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data!.items.map((item) => (
              <TournamentCard key={item.id} tournament={item} />
            ))}
          </div>
          {data!.total > PAGE_SIZE && (
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-500 tabular-nums">
                {page} / {Math.ceil(data!.total / PAGE_SIZE)}
              </span>
              <Button variant="secondary" size="sm" disabled={page * PAGE_SIZE >= data!.total} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {creating && (
        <TournamentFormDialog
          clubId={club.id}
          tournament={null}
          onClose={() => setCreating(false)}
          onSaved={(created) => navigate(`/tournaments/${created.id}`)}
        />
      )}
    </>
  )
}

function TournamentCard({ tournament: x }: { tournament: TournamentSummary }) {
  const { t, i18n } = useTranslation()
  const progress = x.matchCount ? Math.round((x.finishedMatchCount / x.matchCount) * 100) : 0
  return (
    <Link to={`/tournaments/${x.id}`} className="group">
      <Card className="flex h-full flex-col p-5 transition group-hover:-translate-y-0.5 group-hover:border-emerald-300 group-hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 ring-1 ring-amber-200/70">
            <Trophy className="h-5 w-5" />
          </div>
          <StatusPill status={x.status} />
        </div>
        <h3 className="mt-4 line-clamp-2 font-semibold text-slate-900 group-hover:text-emerald-700">{x.name}</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          {[x.category, t(`tournaments.format.${x.format}`)].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            {formatDateRange(x.startDate, x.endDate, i18n.language)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-slate-400" />
            {t('tournaments.teams', { count: x.teamCount })}
            {x.maxTeams ? ` / ${x.maxTeams}` : ''}
          </span>
        </div>
        <div className="mt-auto pt-5">
          {x.championName ? (
            <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Trophy className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {t('tournaments.champion')}: <strong>{x.championName}</strong>
              </span>
            </p>
          ) : x.matchCount > 0 ? (
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                <span>{t('tournaments.progress', { done: x.finishedMatchCount, total: x.matchCount })}</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  )
}
