import type { Camera, Clip, ClipStatus, Session } from '@padel/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Button, Card, EmptyState, ErrorText, Loading, PageHeader } from '../components/ui'
import { errorMessage } from '../lib/errors'
import {
  useActiveSession,
  useCameras,
  useCourt,
  useEndSession,
  useRequestReplay,
  useSessionClips,
  useSessionQr,
  useStartSession,
} from '../lib/queries'
import { useSessionRealtime } from '../lib/realtime'
import { useClub } from '../lib/use-club'

const DURATIONS = [15, 30, 60] as const

export function SessionPage() {
  const { t } = useTranslation()
  const { courtId = '' } = useParams()
  const club = useClub()
  const court = useCourt(courtId)
  const active = useActiveSession(courtId)
  const startSession = useStartSession(courtId)

  if (court.isPending || active.isPending) return <Loading label={t('common.loading')} />
  if (court.error || active.error) return <ErrorText>{errorMessage(court.error ?? active.error, t)}</ErrorText>

  const session = active.data.session

  return (
    <>
      <Link to={`/courts/${courtId}`} className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← {court.data.name}
      </Link>
      <PageHeader title={`${t('session.title')} · ${court.data.name}`} />

      {session ? (
        <ActiveSession session={session} courtId={courtId} clubId={club.id} />
      ) : (
        <EmptyState>
          <p className="font-medium text-slate-700">{t('session.none')}</p>
          <p className="mt-1">{t('session.noneHint')}</p>
          <Button className="mt-4" onClick={() => startSession.mutate()} disabled={startSession.isPending}>
            {t('session.start')}
          </Button>
          {startSession.error && (
            <div className="mt-3">
              <ErrorText>{errorMessage(startSession.error, t)}</ErrorText>
            </div>
          )}
        </EmptyState>
      )}
    </>
  )
}

function ActiveSession({ session, courtId, clubId }: { session: Session; courtId: string; clubId: string }) {
  const { t, i18n } = useTranslation()
  const qr = useSessionQr(session.id)
  const endSession = useEndSession(courtId)
  const connected = useSessionRealtime(session.id)
  const time = new Date(session.startedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-6">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {t('session.active')}
            </span>
            <span className="text-xs text-slate-500">{t('session.startedAt', { time })}</span>
          </div>
          <h2 className="font-semibold">{t('session.qrTitle')}</h2>
          <p className="mb-3 text-sm text-slate-500">{t('session.qrHint')}</p>
          {qr.data ? (
            <>
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.data.svg)}`}
                alt={qr.data.joinUrl}
                className="mx-auto w-full max-w-64 rounded-lg border border-slate-200"
              />
              <p className="mt-3 text-xs font-medium text-slate-700">{t('session.joinUrl')}</p>
              <p className="break-all font-mono text-xs text-slate-600">{qr.data.joinUrl}</p>
            </>
          ) : qr.error ? (
            <ErrorText>{errorMessage(qr.error, t)}</ErrorText>
          ) : (
            <Loading label={t('common.loading')} />
          )}
          <p className="mt-3 text-sm text-slate-600">{t('session.players', { count: session.playerCount })}</p>
          <Button
            variant="danger"
            className="mt-4 w-full"
            disabled={endSession.isPending}
            onClick={() => window.confirm(t('session.confirmEnd')) && endSession.mutate(session.id)}
          >
            {t('session.end')}
          </Button>
          {endSession.error && (
            <div className="mt-3">
              <ErrorText>{errorMessage(endSession.error, t)}</ErrorText>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <ReplaySimulator sessionId={session.id} />
        <ClipList sessionId={session.id} clubId={clubId} connected={connected} />
      </div>
    </div>
  )
}

function ReplaySimulator({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const requestReplay = useRequestReplay(sessionId)
  const [durationSec, setDurationSec] = useState<number>(30)

  return (
    <Card className="p-4">
      <h2 className="font-semibold">{t('session.simulator')}</h2>
      <p className="mb-4 text-sm text-slate-500">{t('session.simulatorHint')}</p>
      <div className="flex flex-wrap items-center gap-6">
        <button
          type="button"
          onClick={() => requestReplay.mutate({ durationSec })}
          disabled={requestReplay.isPending}
          className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold tracking-wider text-white shadow-lg ring-8 ring-emerald-100 transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
        >
          {requestReplay.isPending ? t('session.requesting') : t('session.replay')}
        </button>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">{t('session.duration')}</p>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationSec(d)}
                className={`px-3 py-1.5 text-sm ${durationSec === d ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t('session.seconds', { count: d })}
              </button>
            ))}
          </div>
        </div>
      </div>
      {requestReplay.error && (
        <div className="mt-4">
          <ErrorText>{errorMessage(requestReplay.error, t)}</ErrorText>
        </div>
      )}
    </Card>
  )
}

function ClipList({ sessionId, clubId, connected }: { sessionId: string; clubId: string; connected: boolean }) {
  const { t } = useTranslation()
  const clips = useSessionClips(sessionId)
  const cameras = useCameras(clubId)
  const cameraById = new Map<string, Camera>(cameras.data?.map((c) => [c.id, c]))

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t('session.clips')}</h2>
        <span className={`inline-flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-700' : 'text-slate-400'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          {connected ? t('session.realtimeOn') : t('session.realtimeOff')}
        </span>
      </div>
      {clips.isPending ? (
        <Loading label={t('common.loading')} />
      ) : clips.error ? (
        <ErrorText>{errorMessage(clips.error, t)}</ErrorText>
      ) : clips.data.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{t('session.noClips')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {clips.data.map((clip) => (
            <ClipRow key={clip.id} clip={clip} camera={cameraById.get(clip.cameraId)} />
          ))}
        </ul>
      )}
    </Card>
  )
}

const clipStyles: Record<ClipStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  PROCESSING: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  READY: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  FAILED: 'bg-red-50 text-red-700 ring-red-600/20',
}

function ClipRow({ clip, camera }: { clip: Clip; camera: Camera | undefined }) {
  const { t, i18n } = useTranslation()
  const fmt = (d: Date) => d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const start = new Date(clip.startAt)
  const end = new Date(start.getTime() + clip.durationSec * 1000)

  return (
    <li className="py-3" data-clip-id={clip.id} data-status={clip.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{camera?.name ?? clip.cameraId}</p>
          <p className="text-xs text-slate-500">
            {t('session.range', { from: fmt(start), to: fmt(end) })} · {t('session.seconds', { count: clip.durationSec })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {clip.downloadUrl && (
            <a href={clip.downloadUrl} download className="text-sm font-medium text-emerald-700 hover:underline">
              {t('session.download')}
            </a>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${clipStyles[clip.status]}`}
          >
            {(clip.status === 'PENDING' || clip.status === 'PROCESSING') && (
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {t(`clipStatus.${clip.status}`)}
          </span>
        </div>
      </div>
      {clip.status === 'FAILED' && clip.error && <p className="mt-2 text-xs text-red-600">{clip.error}</p>}
      {clip.downloadUrl && (
        <video src={clip.downloadUrl} controls playsInline preload="metadata" className="mt-3 w-full max-w-xl rounded-lg bg-black" />
      )}
    </li>
  )
}
