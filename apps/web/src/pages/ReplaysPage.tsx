import type { ClipLibraryItem, ClipLibraryQuery, ClipStatus } from '@padel/shared'
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  HardDrive,
  Loader2,
  Play,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipDialog } from '../components/ClipDialog'
import { Button, Card, ErrorText, Input, Loading, PageHeader, Select } from '../components/ui'
import { UserAvatar } from '../components/UserAvatar'
import { errorMessage } from '../lib/errors'
import { formatBytes, relativeTime } from '../lib/format'
import { useClipLibrary, useCourts, useDeleteClip } from '../lib/queries'
import { useClub } from '../lib/use-club'

const PAGE_SIZE = 24
const STATUSES: ClipStatus[] = ['READY', 'PROCESSING', 'PENDING', 'FAILED']

/** Replay library: every clip of the club with storage stats, filters, playback and delete. */
export function ReplaysPage() {
  const { t, i18n } = useTranslation()
  const club = useClub()
  const courts = useCourts(club.id)
  const [filters, setFilters] = useState<Omit<ClipLibraryQuery, 'clubId' | 'page' | 'pageSize'>>({})
  const [page, setPage] = useState(1)
  const [playing, setPlaying] = useState<ClipLibraryItem | null>(null)
  const remove = useDeleteClip()
  const library = useClipLibrary({ clubId: club.id, ...filters, page, pageSize: PAGE_SIZE })
  const data = library.data
  const setFilter = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }))
    setPage(1)
  }
  const filtered = Object.values(filters).some(Boolean)

  const onDelete = (clip: ClipLibraryItem) => {
    if (window.confirm(t('replays.confirmDelete'))) remove.mutate(clip.id)
  }

  return (
    <>
      <PageHeader title={t('replays.title')} description={t('replays.description', { club: club.name })} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Film}
          label={t('replays.statTotal')}
          value={data?.stats.total}
          hint={data ? t('replays.statReady', { count: data.stats.ready }) : ''}
          tone="emerald"
        />
        <Stat icon={Zap} label={t('replays.statToday')} value={data?.stats.today} hint={t('replays.statTodayHint')} tone="sky" />
        <Stat
          icon={HardDrive}
          label={t('replays.statStorage')}
          value={data ? formatBytes(data.stats.storageBytes, i18n.language) : undefined}
          hint={t('replays.statStorageHint')}
          tone="violet"
        />
        <Stat
          icon={TriangleAlert}
          label={t('replays.statFailed')}
          value={data?.stats.failed}
          hint={t('replays.statFailedHint')}
          tone="amber"
        />
      </div>

      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500">{t('cameras.court')}</span>
          <Select value={filters.courtId ?? ''} onChange={(e) => setFilter('courtId', e.target.value)}>
            <option value="">{t('replays.allCourts')}</option>
            {courts.data?.map((court) => (
              <option key={court.id} value={court.id}>
                {court.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500">{t('cameras.status')}</span>
          <Select value={filters.status ?? ''} onChange={(e) => setFilter('status', e.target.value as ClipStatus)}>
            <option value="">{t('replays.allStatus')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`clipStatus.${s}`)}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500">{t('replays.from')}</span>
          <Input type="date" value={filters.from ?? ''} max={filters.to} onChange={(e) => setFilter('from', e.target.value)} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500">{t('replays.to')}</span>
          <Input type="date" value={filters.to ?? ''} min={filters.from} onChange={(e) => setFilter('to', e.target.value)} />
        </label>
        <Button
          variant="ghost"
          disabled={!filtered}
          onClick={() => {
            setFilters({})
            setPage(1)
          }}
        >
          <RotateCcw className="h-4 w-4" />
          {t('replays.resetFilter')}
        </Button>
      </Card>

      {remove.error && (
        <div className="mb-4">
          <ErrorText>{errorMessage(remove.error, t)}</ErrorText>
        </div>
      )}

      {library.isPending ? (
        <Loading label={t('common.loading')} />
      ) : library.error ? (
        <ErrorText>{errorMessage(library.error, t)}</ErrorText>
      ) : data!.items.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <Film className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">{t('replays.empty')}</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {data!.items.map((clip) => (
              <ClipCard key={clip.id} clip={clip} onPlay={setPlaying} onDelete={onDelete} />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-slate-500">
              {t('replays.showing', {
                from: (data!.page - 1) * data!.pageSize + 1,
                to: Math.min(data!.page * data!.pageSize, data!.total),
                total: data!.total,
              })}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" disabled={page * PAGE_SIZE >= data!.total} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {playing?.downloadUrl && (
        <ClipDialog
          src={playing.downloadUrl}
          title={`${playing.court.name} · ${playing.camera.name}`}
          subtitle={new Date(playing.createdAt).toLocaleString(i18n.language, { dateStyle: 'full', timeStyle: 'short' })}
          onClose={() => setPlaying(null)}
        />
      )}
    </>
  )
}

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: number | string | undefined
  hint: string
  tone: keyof typeof TONES
}) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value ?? '–'}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p>
      </div>
    </Card>
  )
}

function ClipCard({
  clip,
  onPlay,
  onDelete,
}: {
  clip: ClipLibraryItem
  onPlay: (clip: ClipLibraryItem) => void
  onDelete: (clip: ClipLibraryItem) => void
}) {
  const { t, i18n } = useTranslation()
  const ready = clip.status === 'READY' && !!clip.downloadUrl
  const created = new Date(clip.createdAt)
  const duration = `${Math.floor(clip.durationSec / 60)}:${String(clip.durationSec % 60).padStart(2, '0')}`

  return (
    <Card className="group flex flex-col overflow-hidden">
      <div className="relative aspect-video bg-ink-950">
        {ready ? (
          <button type="button" onClick={() => onPlay(clip)} className="absolute inset-0" aria-label={t('replays.play')}>
            {/* #t=… makes the browser show a frame from the clip as the thumbnail. */}
            <video src={`${clip.downloadUrl}#t=4`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-ink-950/10 transition group-hover:bg-ink-950/30">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-ink-950 shadow-lg transition group-hover:scale-110">
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </span>
            </span>
            <span className="absolute right-2 bottom-2 rounded-md bg-ink-950/75 px-1.5 py-0.5 font-mono text-xs text-white">
              {duration}
            </span>
          </button>
        ) : clip.status === 'FAILED' ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-400">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <p className="line-clamp-2 text-xs">{clip.error}</p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            <p className="text-xs">{t('replays.processing')}</p>
          </div>
        )}
        {!ready && (
          <span
            className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              clip.status === 'FAILED' ? 'bg-red-500/90 text-white' : 'bg-sky-500/90 text-white'
            }`}
          >
            {t(`clipStatus.${clip.status}`)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">
            {clip.court.name} <span className="font-normal text-slate-400">· {clip.camera.name}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            <span title={relativeTime(clip.createdAt, i18n.language)}>
              {created.toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            {clip.sizeBytes !== null && <span className="text-slate-300">·</span>}
            {clip.sizeBytes !== null && <span>{formatBytes(clip.sizeBytes, i18n.language)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <UserAvatar
            name={clip.requestedBy.name ?? t('replays.unknownPlayer')}
            url={clip.requestedBy.avatarUrl}
            className="h-6 w-6 text-[10px]"
          />
          <span className="truncate">{t('replays.requestedBy', { name: clip.requestedBy.name ?? t('replays.unknownPlayer') })}</span>
        </div>
        <div className="mt-auto flex items-center gap-1 border-t border-slate-100 pt-3">
          {ready && (
            <>
              <button
                type="button"
                onClick={() => onPlay(clip)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <Play className="h-3.5 w-3.5" />
                {t('replays.play')}
              </button>
              <a
                href={clip.downloadUrl!}
                download={`replay-${clip.id}.mp4`}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <Download className="h-3.5 w-3.5" />
                {t('replays.download')}
              </a>
            </>
          )}
          <button
            type="button"
            onClick={() => onDelete(clip)}
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label={t('replays.delete')}
            title={t('replays.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Card>
  )
}
