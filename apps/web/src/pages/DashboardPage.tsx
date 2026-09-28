import type { Camera, CameraStatus, ClipStatus, ClubOverview, Court, RecentClip } from '@padel/shared'
import {
  AlertTriangle,
  ArrowUpRight,
  Camera as CameraIcon,
  Clapperboard,
  Loader2,
  Play,
  Plus,
  Radio,
  RectangleHorizontal,
  Tv,
  Users,
} from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CourtGraphic } from '../components/brand'
import { ClipDialog } from '../components/ClipDialog'
import { buttonClass } from '../components/button-class'
import { Card, EmptyState, ErrorText, Loading } from '../components/ui'
import { useAuth } from '../lib/auth-context'
import { cameraState, videoLabel, type CameraState } from '../lib/camera-state'
import { errorMessage } from '../lib/errors'
import { dayPart, relativeTime } from '../lib/format'
import { useCameras, useCameraStatus, useClubOverview, useCourts } from '../lib/queries'
import { useClub } from '../lib/use-club'

type ActiveSession = ClubOverview['activeSessions'][number]

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const club = useClub()
  const { user } = useAuth()
  const courts = useCourts(club.id)
  const cameras = useCameras(club.id)
  const status = useCameraStatus(club.id)
  const overview = useClubOverview(club.id)
  const [playing, setPlaying] = useState<RecentClip | null>(null)

  if (courts.isPending || cameras.isPending) return <Loading label={t('common.loading')} />
  if (courts.error || cameras.error) return <ErrorText>{errorMessage(courts.error ?? cameras.error, t)}</ErrorText>

  const statusById = new Map<string, CameraStatus>(status.data?.cameras.map((s) => [s.cameraId, s]))
  const reachable = status.data?.mediaServerReachable
  const stateOf = (camera: Camera) => cameraState(camera.isActive, statusById.get(camera.id), reachable)
  const onlineCount = cameras.data.filter((c) => stateOf(c) === 'online').length
  const sessionsByCourt = new Map(overview.data?.activeSessions.map((s) => [s.courtId, s]))
  const players = overview.data?.activeSessions.reduce((sum, s) => sum + s.playerCount, 0) ?? 0
  const today = overview.data?.clipsToday
  const name = user?.name ?? user?.username ?? user?.email ?? ''
  const percent = cameras.data.length ? Math.round((onlineCount / cameras.data.length) * 100) : 0

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700">
            {new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t(`dashboard.greeting${dayPart()}`, { name })}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">{club.name}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/tv-setup" className={buttonClass('secondary')}>
            <Tv className="h-4 w-4" />
            {t('dashboard.openTv')}
          </Link>
          <Link to="/courts" className={buttonClass('dark')}>
            <Plus className="h-4 w-4" />
            {t('dashboard.addCourt')}
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={RectangleHorizontal}
          tone="slate"
          label={t('dashboard.courts')}
          value={courts.data.length}
          sub={t('dashboard.courtsSub', { count: cameras.data.length })}
        />
        <StatCard
          icon={Radio}
          tone="emerald"
          label={t('dashboard.camerasOnline')}
          value={
            <>
              {onlineCount}
              <span className="text-lg font-medium text-slate-400"> / {cameras.data.length}</span>
            </>
          }
          sub={t('dashboard.camerasOnlineSub', { percent })}
          progress={percent}
        />
        <StatCard
          icon={Users}
          tone="sky"
          label={t('dashboard.activeSessions')}
          value={overview.data?.activeSessions.length ?? '–'}
          sub={t('dashboard.activeSessionsSub', { count: players })}
        />
        <StatCard
          icon={Clapperboard}
          tone="violet"
          label={t('dashboard.replaysToday')}
          value={today?.total ?? '–'}
          sub={t('dashboard.replaysTodaySub', { ready: today?.ready ?? 0, failed: today?.failed ?? 0 })}
        />
      </section>

      {reachable === false && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t('status.mediaUnreachable')}
        </div>
      )}

      <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_360px]">
        <section className="min-w-0">
          <SectionTitle title={t('dashboard.courtsTitle')} hint={t('dashboard.courtsHint')} />
          {courts.data.length === 0 ? (
            <EmptyState>
              {t('dashboard.noCourts')}{' '}
              <Link to="/courts" className="font-medium text-emerald-700 hover:underline">
                {t('dashboard.addCourt')}
              </Link>
            </EmptyState>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {courts.data.map((court) => (
                <CourtCard
                  key={court.id}
                  court={court}
                  cameras={cameras.data.filter((c) => c.courtId === court.id)}
                  stateOf={stateOf}
                  statusById={statusById}
                  session={sessionsByCourt.get(court.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0">
          <SectionTitle title={t('dashboard.recentTitle')} hint={t('dashboard.recentHint')} />
          <RecentReplays clips={overview.data?.recentClips} loading={overview.isPending} onPlay={setPlaying} />
        </section>
      </div>

      {playing?.downloadUrl && (
        <ClipDialog
          src={playing.downloadUrl}
          title={`${playing.courtName} · ${playing.cameraName}`}
          subtitle={new Date(playing.startAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'medium' })}
          onClose={() => setPlaying(null)}
        />
      )}
    </>
  )
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <p className="hidden text-xs text-slate-400 sm:block">{hint}</p>
    </div>
  )
}

const tones = {
  slate: 'bg-slate-100 text-slate-700',
  emerald: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  progress,
}: {
  icon: ComponentType<{ className?: string }>
  tone: keyof typeof tones
  label: string
  value: ReactNode
  sub: string
  progress?: number
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">{sub}</p>
    </Card>
  )
}

const dotStyles: Record<CameraState, string> = {
  online: 'bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20',
  offline: 'bg-slate-300',
  inactive: 'bg-amber-400',
  unknown: 'bg-slate-200',
}

function CourtCard({
  court,
  cameras,
  stateOf,
  statusById,
  session,
}: {
  court: Court
  cameras: Camera[]
  stateOf: (camera: Camera) => CameraState
  statusById: Map<string, CameraStatus>
  session: ActiveSession | undefined
}) {
  const { t } = useTranslation()
  const live = cameras.some((c) => stateOf(c) === 'online')

  return (
    <Card className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5">
      <Link to={`/courts/${court.id}`} className="relative block aspect-[2/1] overflow-hidden bg-ink-900">
        <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_0%,rgba(255,255,255,0.08),transparent)]" />
        <CourtGraphic live={live} className="absolute inset-0 h-full w-full p-4 transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold tracking-wider text-white shadow-lg shadow-red-900/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {t('dashboard.live')}
            </span>
          ) : (
            <span className="rounded-md bg-black/40 px-2 py-1 text-[11px] font-bold tracking-wider text-slate-300 backdrop-blur">
              {t('dashboard.offline')}
            </span>
          )}
          {session && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-800 backdrop-blur">
              <Users className="h-3 w-3" />
              {t('dashboard.sessionChip', { count: session.playerCount })}
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent px-4 pt-10 pb-3">
          <h3 className="text-lg font-semibold tracking-tight text-white">{court.name}</h3>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        {cameras.length === 0 ? (
          <p className="text-sm text-slate-500">{t('dashboard.noCameras')}</p>
        ) : (
          <ul className="space-y-2">
            {cameras.map((camera) => {
              const state = stateOf(camera)
              const label = videoLabel(statusById.get(camera.id))
              return (
                <li key={camera.id} className="flex items-center gap-2.5 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotStyles[state]}`} />
                  <CameraIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{camera.name}</span>
                  <span className="shrink-0 font-mono text-xs text-slate-400">{label ?? t(`status.${state}`)}</span>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex gap-2 pt-1">
          <Link to={`/courts/${court.id}`} className={buttonClass(live ? 'primary' : 'secondary', 'sm', 'min-w-0 flex-1')}>
            <Radio className="h-3.5 w-3.5" />
            {t('dashboard.watchLive')}
          </Link>
          <Link to={`/courts/${court.id}/session`} className={buttonClass('secondary', 'sm', 'min-w-0 flex-1')}>
            {t('dashboard.session')}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  )
}

const clipBadge: Record<ClipStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  PROCESSING: 'bg-sky-50 text-sky-700',
  READY: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-700',
}

function RecentReplays({
  clips,
  loading,
  onPlay,
}: {
  clips: RecentClip[] | undefined
  loading: boolean
  onPlay: (clip: RecentClip) => void
}) {
  const { t, i18n } = useTranslation()
  if (loading) return <Loading label={t('common.loading')} />

  return (
    <Card className="overflow-hidden">
      {!clips?.length ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Clapperboard className="h-6 w-6" />
          </span>
          <p className="max-w-60 text-sm text-slate-500">{t('dashboard.recentEmpty')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {clips.map((clip) => {
            const ready = clip.status === 'READY' && !!clip.downloadUrl
            return (
              <li key={clip.id}>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={() => onPlay(clip)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition enabled:hover:bg-slate-50 disabled:cursor-default"
                  title={ready ? t('dashboard.play') : undefined}
                >
                  <span
                    className={`relative flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg ${
                      ready ? 'bg-ink-900 text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {ready && <CourtGraphic live className="absolute inset-0 h-full w-full opacity-40" />}
                    {clip.status === 'PENDING' || clip.status === 'PROCESSING' ? (
                      <Loader2 className="relative h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="relative h-4 w-4 fill-current" />
                    )}
                    <span className="absolute right-1 bottom-0.5 text-[10px] font-semibold tabular-nums">
                      {clip.durationSec}s
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{clip.courtName}</span>
                    <span className="flex min-w-0 gap-1 text-xs text-slate-500">
                      <span className="truncate">{clip.cameraName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{relativeTime(clip.createdAt, i18n.language)}</span>
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${clipBadge[clip.status]}`}>
                    {t(`clipStatus.${clip.status}`)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
