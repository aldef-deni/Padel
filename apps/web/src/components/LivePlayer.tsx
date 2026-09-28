import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { startWhep } from '../media/whep'
import { hlsUrl, whepUrl } from '../media/urls'
import { Button } from './ui'

type Mode = 'webrtc' | 'hls'
type Phase = 'connecting' | 'playing' | 'failed'

const WEBRTC_TIMEOUT_MS = 10_000

interface Props {
  streamPath: string
  /** From camera status; undefined while unknown. */
  online: boolean | undefined
  active: boolean
}

/**
 * Plays a MediaMTX path with WebRTC (low latency) and falls back to HLS
 * when WebRTC can't connect (e.g. UDP 8189 blocked).
 */
export function LivePlayer({ streamPath, online, active }: Props) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mode, setMode] = useState<Mode>('webrtc')
  const [phase, setPhase] = useState<Phase>('connecting')
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const canPlay = active && online !== false

  // Start over with WebRTC whenever the camera comes back.
  const [prevCanPlay, setPrevCanPlay] = useState(canPlay)
  if (canPlay !== prevCanPlay) {
    setPrevCanPlay(canPlay)
    if (!canPlay) {
      setMode('webrtc')
      setNotice(null)
    }
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || !canPlay) return
    setPhase('connecting')
    let disposed = false
    let cleanup = () => {}

    const onPlaying = () => !disposed && setPhase('playing')
    video.addEventListener('playing', onPlaying)
    const fail = () => !disposed && setPhase('failed')

    if (mode === 'webrtc') {
      const fallback = () => {
        if (disposed) return
        setNotice(t('player.fallbackHls'))
        setMode('hls')
      }
      const timer = setTimeout(fallback, WEBRTC_TIMEOUT_MS)
      let close = () => {}
      startWhep(whepUrl(streamPath), (stream) => {
        // A cancelled session can still fire ontrack; don't let it replace the live stream.
        if (!disposed && video.srcObject !== stream) video.srcObject = stream
      })
        .then((session) => {
          if (disposed) return session.close()
          close = session.close
          session.pc.addEventListener('connectionstatechange', () => {
            if (session.pc.connectionState === 'connected') clearTimeout(timer)
            if (session.pc.connectionState === 'failed') fallback()
          })
        })
        .catch(fallback)
      cleanup = () => {
        clearTimeout(timer)
        close()
        video.srcObject = null
      }
    } else {
      // hls.js is large, so it is only loaded when HLS is actually used.
      let destroy = () => {}
      import('hls.js')
        .then(({ default: Hls }) => {
          if (disposed) return
          if (Hls.isSupported()) {
            const hls = new Hls({ lowLatencyMode: true })
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) fail()
            })
            hls.loadSource(hlsUrl(streamPath))
            hls.attachMedia(video)
            destroy = () => hls.destroy()
          } else {
            // Safari plays HLS natively.
            video.src = hlsUrl(streamPath)
            video.addEventListener('error', fail)
            destroy = () => {
              video.removeEventListener('error', fail)
              video.removeAttribute('src')
              video.load()
            }
          }
        })
        .catch(fail)
      cleanup = () => destroy()
    }

    return () => {
      disposed = true
      video.removeEventListener('playing', onPlaying)
      cleanup()
    }
  }, [streamPath, mode, canPlay, attempt, t])

  const retry = () => {
    setNotice(null)
    setMode('webrtc')
    setAttempt((n) => n + 1)
  }

  return (
    <div className="overflow-hidden rounded-xl bg-slate-900">
      <div className="relative aspect-video">
        <video
          ref={videoRef}
          className={`h-full w-full bg-black ${canPlay ? '' : 'invisible'}`}
          autoPlay
          muted
          playsInline
          controls
        />
        {!canPlay && (
          <Overlay
            title={active ? t('player.offline') : t('player.inactive')}
            hint={active ? t('player.offlineHint') : undefined}
          />
        )}
        {canPlay && phase === 'connecting' && <Overlay title={t('player.connecting')} spinner />}
        {canPlay && phase === 'failed' && (
          <Overlay title={t('player.failed')}>
            <Button variant="secondary" onClick={retry}>
              {t('common.retry')}
            </Button>
          </Overlay>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-slate-300">
        <span className="truncate font-mono">{streamPath}</span>
        <div className="flex items-center gap-2">
          {notice && <span className="text-amber-300">{notice}</span>}
          {canPlay && (
            <div className="flex overflow-hidden rounded-md border border-slate-700">
              {(['webrtc', 'hls'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setNotice(null)
                    setMode(m)
                    setAttempt((n) => n + 1)
                  }}
                  className={`px-2 py-0.5 ${mode === m ? 'bg-slate-700 text-white' : 'hover:bg-slate-800'}`}
                >
                  {t(`player.${m}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Overlay({
  title,
  hint,
  spinner,
  children,
}: {
  title: string
  hint?: string
  spinner?: boolean
  children?: ReactNode
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 p-4 text-center text-slate-200">
      {spinner && (
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
      )}
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-xs text-sm text-slate-400">{hint}</p>}
      {children}
    </div>
  )
}
