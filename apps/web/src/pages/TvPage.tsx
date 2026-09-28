import type { Clip, TvSnapshot } from '@padel/shared'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router'
import { ApiRequestError } from '../lib/api'
import { useTvSnapshot } from '../lib/queries'
import { useNow, useTvQueue, useTvSocket, useWakeLock } from '../lib/tv'

/** Extra time on top of the clip length before a stuck video is skipped. */
const STALL_GRACE_MS = 15_000

/**
 * Kiosk page for a club TV: /tv/:clubId?key=<TV link key>. No login.
 * Plays every clip of the club as soon as it is READY, then returns to the idle screen.
 */
export function TvPage() {
  const { t } = useTranslation()
  const { clubId = '' } = useParams()
  const [params] = useSearchParams()
  const key = params.get('key') ?? ''
  const snapshot = useTvSnapshot(clubId, key)
  const [state, dispatch] = useTvQueue()
  const connected = useTvSocket(
    clubId,
    key,
    (clip) => {
      dispatch({ type: 'clip', clip })
      // A camera added after the page loaded: refresh names.
      if (snapshot.data && !snapshot.data.cameras.some((c) => c.id === clip.cameraId)) void snapshot.refetch()
    },
    () => void snapshot.refetch(), // 401 -> invalid link screen
  )
  useWakeLock()

  if (snapshot.error instanceof ApiRequestError && snapshot.error.status === 401) {
    return (
      <Screen>
        <div className="flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
          <p className="text-4xl font-semibold">{t('tv.invalidLink')}</p>
          <p className="text-2xl text-slate-400">{t('tv.invalidLinkHint')}</p>
        </div>
      </Screen>
    )
  }
  if (!snapshot.data) {
    return (
      <Screen>
        <div className="flex h-full items-center justify-center">
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
        </div>
      </Screen>
    )
  }

  const data = snapshot.data
  return (
    <Screen>
      {state.current ? (
        <ReplayPlayer
          key={state.current.id}
          clip={state.current}
          data={data}
          onDone={() => dispatch({ type: 'finished' })}
        />
      ) : (
        <IdleScreen data={data} last={state.last ?? data.recentClips[0] ?? null} />
      )}
      <StatusBar data={data} preparing={state.preparing} connected={connected} />
    </Screen>
  )
}

/** Full-screen dark canvas; a click toggles browser full screen. */
function Screen({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [hint, setHint] = useState(() => !document.fullscreenElement)

  useEffect(() => {
    const onChange = () => setHint(!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }

  return (
    <div
      onClick={toggle}
      className="relative h-screen w-screen cursor-none overflow-hidden bg-slate-950 text-white select-none"
    >
      {children}
      {hint && (
        <p className="absolute top-4 left-1/2 -translate-x-1/2 cursor-pointer rounded-full bg-white/10 px-4 py-1.5 text-sm text-slate-300">
          {t('tv.tapFullscreen')}
        </p>
      )}
    </div>
  )
}

function ClubMark({ data, size }: { data: TvSnapshot; size: 'lg' | 'sm' }) {
  const box = size === 'lg' ? 'h-48 max-w-[40vw]' : 'h-14 max-w-64'
  if (data.club.logoUrl) {
    return <img src={data.club.logoUrl} alt={data.club.name} className={`${box} object-contain`} />
  }
  return (
    <span className={size === 'lg' ? 'text-7xl font-bold tracking-tight' : 'text-3xl font-bold'}>
      {data.club.name}
    </span>
  )
}

function IdleScreen({ data, last }: { data: TvSnapshot; last: Clip | null }) {
  const { t, i18n } = useTranslation()
  const now = useNow()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 bg-[radial-gradient(ellipse_at_center,_#064e3b_0%,_#020617_70%)] p-12 text-center">
      <ClubMark data={data} size="lg" />
      <div>
        <p className="text-6xl font-bold tracking-tight">{t('tv.idleTitle')}</p>
        <p className="mt-4 text-3xl text-slate-300">{t('tv.idleHint')}</p>
      </div>
      <p className="font-mono text-5xl text-emerald-300 tabular-nums">
        {now.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      {last && (
        <p className="text-xl text-slate-400">
          {t('tv.lastReplay', {
            time: new Date(last.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
            court: courtNameOf(data, last),
          })}
        </p>
      )}
    </div>
  )
}

function ReplayPlayer({ clip, data, onDone }: { clip: Clip; data: TvSnapshot; onDone: () => void }) {
  const { t, i18n } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const [progress, setProgress] = useState(0)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  // Skip a clip that never finishes (network stall, decode error without an event).
  useEffect(() => {
    const timer = setTimeout(() => onDoneRef.current(), clip.durationSec * 1000 + STALL_GRACE_MS)
    return () => clearTimeout(timer)
  }, [clip.durationSec])

  const camera = data.cameras.find((c) => c.id === clip.cameraId)
  const moment = new Date(clip.startAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="absolute inset-0" data-testid="tv-replay" data-clip-id={clip.id}>
      <video
        ref={video}
        src={clip.downloadUrl ?? undefined}
        autoPlay
        muted
        playsInline
        onEnded={onDone}
        onError={onDone}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          if (v.duration) setProgress(v.currentTime / v.duration)
        }}
        className="h-full w-full bg-black object-contain"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent p-8">
        <ClubMark data={data} size="sm" />
        <span className="animate-pulse rounded-xl bg-emerald-500 px-6 py-2 text-4xl font-black tracking-widest shadow-lg">
          {t('tv.replay')}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-8 pb-10">
        <p className="text-5xl font-bold">{courtNameOf(data, clip)}</p>
        <p className="mt-2 text-2xl text-slate-300">
          {camera?.name} · {moment}
        </p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full bg-emerald-400 transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

function StatusBar({ data, preparing, connected }: { data: TvSnapshot; preparing: Clip[]; connected: boolean }) {
  const { t } = useTranslation()
  const courts = [...new Set(preparing.map((c) => courtNameOf(data, c)))]
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
      {courts.map((court) => (
        <span
          key={court}
          className="flex items-center gap-3 rounded-full bg-black/70 px-5 py-2 text-xl text-emerald-200 ring-1 ring-emerald-500/40"
          data-testid="tv-preparing"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
          {t('tv.preparing', { court })}
        </span>
      ))}
      {!connected && (
        <span className="rounded-full bg-amber-500/90 px-4 py-1 text-base text-black">{t('tv.connecting')}</span>
      )}
    </div>
  )
}

function courtNameOf(data: TvSnapshot, clip: Clip) {
  const courtId = data.cameras.find((c) => c.id === clip.cameraId)?.courtId
  return data.courts.find((c) => c.id === courtId)?.name ?? ''
}
