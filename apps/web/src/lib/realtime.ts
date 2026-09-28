import {
  SOCKET_CLIP_UPDATED,
  SOCKET_SUBSCRIBE_SESSION,
  type Clip,
  type SubscribeSessionAck,
} from '@padel/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { getToken } from './api'
import { sessionKeys, upsertClip } from './queries'

/**
 * Subscribes to a session over Socket.IO and applies clip updates to the
 * TanStack Query cache. Returns whether the socket is connected.
 */
export function useSessionRealtime(sessionId: string | undefined) {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    // Same origin: Vite proxies /socket.io to the API.
    const socket = io({ auth: { token: getToken() }, transports: ['websocket'] })

    socket.on('connect', () => {
      socket.emit(SOCKET_SUBSCRIBE_SESSION, { sessionId }, (ack: SubscribeSessionAck) => {
        setConnected(ack.ok)
        // Catch up on anything missed while disconnected.
        if (ack.ok) void queryClient.invalidateQueries({ queryKey: sessionKeys.clips(sessionId) })
      })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))
    socket.on(SOCKET_CLIP_UPDATED, (clip: Clip) => upsertClip(queryClient, clip))

    return () => {
      socket.disconnect()
      setConnected(false)
    }
  }, [sessionId, queryClient])

  return connected
}
