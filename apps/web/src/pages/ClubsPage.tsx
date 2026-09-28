import type { ClubListQuery, ClubWithStats } from '@padel/shared'
import { ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { ClubAvatar } from '../components/ClubAvatar'
import { ClubFormDialog } from '../components/ClubFormDialog'
import { Button, Card, ErrorText, Input, Loading, PageHeader } from '../components/ui'
import { clubErrorMessage } from '../lib/clubs'
import { useClubsStats } from '../lib/queries'

const PAGE_SIZE = 12
type Status = 'ALL' | 'ACTIVE' | 'INACTIVE'

export function ClubsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ClubWithStats | 'new' | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const query: ClubListQuery = {
    search: search || undefined,
    status: status === 'ALL' ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  }
  const clubs = useClubsStats(query)
  const data = clubs.data
  const tabs: { key: Status; label: string }[] = [
    { key: 'ALL', label: t('clubs.all') },
    { key: 'ACTIVE', label: t('clubs.active') },
    { key: 'INACTIVE', label: t('clubs.inactive') },
  ]

  return (
    <>
      <PageHeader
        title={t('clubs.title')}
        description={t('clubs.description')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            {t('clubs.add')}
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatus(tab.key)
                setPage(1)
              }}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                status === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              <span
                className={`rounded-md px-1.5 text-xs tabular-nums ${status === tab.key ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-500'}`}
              >
                {data?.counts[tab.key] ?? '·'}
              </span>
            </button>
          ))}
        </div>
        <div className="w-full lg:w-80">
          <Input
            icon={Search}
            type="search"
            placeholder={t('clubs.search')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {clubs.isPending ? (
        <Loading label={t('common.loading')} />
      ) : clubs.error ? (
        <ErrorText>{clubErrorMessage(clubs.error, t)}</ErrorText>
      ) : data!.items.length === 0 ? (
        <Card className="px-6 py-14 text-center text-sm text-slate-500">{t('clubs.empty')}</Card>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data!.items.map((club) => (
              <ClubCard key={club.id} club={club} onEdit={() => setEditing(club)} />
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between gap-3 text-sm">
            <p className="text-slate-500">
              {t('clubs.showing', {
                from: (data!.page - 1) * data!.pageSize + 1,
                to: Math.min(data!.page * data!.pageSize, data!.total),
                total: data!.total,
              })}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page * PAGE_SIZE >= data!.total}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <ClubFormDialog
          club={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(club) => editing === 'new' && navigate(`/clubs/${club.id}`)}
        />
      )}
    </>
  )
}

function ClubCard({ club, onEdit }: { club: ClubWithStats; onEdit: () => void }) {
  const { t } = useTranslation()
  const stats: [string, number][] = [
    [t('clubs.courts'), club.stats.courts],
    [t('clubs.cameras'), club.stats.cameras],
    [t('clubs.admins'), club.stats.admins],
    [t('clubs.sessions'), club.stats.activeSessions],
    [t('clubs.clips30d'), club.stats.clips30d],
  ]

  return (
    <Card
      className={`group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 ${
        club.isActive ? '' : 'opacity-75'
      }`}
    >
      <div className="flex items-start gap-4 p-5">
        <ClubAvatar club={club} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link to={`/clubs/${club.id}`} className="truncate text-base font-semibold text-slate-900 hover:text-emerald-700">
              {club.name}
            </Link>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                club.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {club.isActive ? t('clubs.active') : t('clubs.inactive')}
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-slate-400">/{club.slug}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            {club.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {club.city}
              </span>
            )}
            {club.openTime && club.closeTime && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {t('clubs.hours', { open: club.openTime, close: club.closeTime })}
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-5 border-y border-slate-100 bg-slate-50/60">
        {stats.map(([label, value]) => (
          <div key={label} className="px-1 py-3 text-center" title={label}>
            <dd className="text-lg font-semibold text-slate-900 tabular-nums">{value}</dd>
            <dt className="truncate text-[10px] font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-auto flex gap-2 p-4">
        <Link
          to={`/clubs/${club.id}`}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-ink-900 px-3 text-xs font-semibold text-white hover:bg-ink-800"
        >
          {t('clubs.manage')}
        </Link>
        <Button variant="secondary" size="sm" onClick={onEdit} aria-label={`${t('clubs.edit')} ${club.name}`}>
          <Pencil className="h-3.5 w-3.5" />
          {t('clubs.edit')}
        </Button>
      </div>
    </Card>
  )
}
