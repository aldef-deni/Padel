import { SOCKET_CLIP_UPDATED, type Clip, type TvSocketAuth } from '@padel/shared'
import { useEffect, useReducer, useRef, useState } from 'react'
import { io } from 'socket.io-client'

/** Queue of READY clips to play on the TV, plus clips still being prepared. */
export interface TvState {
  current: Clip | null
  queue: Clip[]
  preparing: Clip[]
  /** Last clip shown on screen (for the idle screen). */
  last: Clip | null
  /** Clip ids already shown or queued, so a repeated READY event plays once. */
  seen: string[]
}

type Action = { type: 'clip'; clip: Clip } | { type: 'finished' }

const MAX_QUEUE = 6

export const initialTvState: TvState = { current: null, queue: [], preparing: [], last: null, seen: [] }

export function tvReducer(state: TvState, action: Action): TvState {
  if (action.type === 'finished') {
    const [next = null, ...queue] = state.queue
    return { ...state, current: next, queue, last: state.current ?? state.last }
  }
  const { clip } = action
  const preparing = state.preparing.filter((c) => c.id !== clip.id)
  if (clip.status === 'PENDING' || clip.status === 'PROCESSING') {
    return { ...state, preparing: [...preparing, clip] }
  }
  if (clip.status !== 'READY' || !clip.downloadUrl || state.seen.includes(clip.id)) {
    return { ...state, preparing }
  }
  const seen = [...state.seen, clip.id].slice(-50)
  if (!state.current) return { ...state, preparing, seen, current: clip }
  // Keep only the newest clips if replays pile up.
  return { ...state, preparing, seen, queue: [...state.queue, clip].slice(-MAX_QUEUE) }
}

/** Connects the TV screen to the club room and dispatches clip updates. */
export function useTvSocket(
  clubId: string,
  tvKey: string,
  onClip: (clip: Clip) => void,
  /** Key rejected or replaced by an admin: re-check the link. */
  onRejected: () => void,
) {
  const [connected, setConnected] = useState(false)
  const handlers = useRef({ onClip, onRejected })
  useEffect(() => {
    handlers.current = { onClip, onRejected }
  })

  useEffect(() => {
    if (!clubId || !tvKey) return
    const auth: TvSocketAuth = { clubId, tvKey }
    const socket = io({ auth, transports: ['websocket'] })
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', (reason) => {
      setConnected(false)
      // The server only kicks TVs when the link key was replaced; it won't auto-reconnect.
      if (reason === 'io server disconnect') handlers.current.onRejected()
    })
    socket.on('connect_error', (err) => {
      setConnected(false)
      if (err.message === 'Unauthorized') handlers.current.onRejected()
    })
    socket.on(SOCKET_CLIP_UPDATED, (clip: Clip) => handlers.current.onClip(clip))
    return () => {
      socket.disconnect()
    }
  }, [clubId, tvKey])

  return connected
}

export function useTvQueue() {
  return useReducer(tvReducer, initialTvState)
}

/** Current time, updated every second (for the on-screen clock). */
export function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** Keeps the TV from sleeping while the page is visible (where supported). */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const request = () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          lock = l
        })
        .catch(() => {}) // Not allowed (e.g. insecure context): the TV's own settings apply.
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      document.removeEventListener('visibilitychange', request)
      void lock?.release()
    }
  }, [])
}
