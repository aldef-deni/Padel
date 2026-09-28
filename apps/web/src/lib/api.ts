import type { ApiError } from '@padel/shared'

const TOKEN_KEY = 'padel.token'

export class ApiRequestError extends Error {
  readonly status: number
  readonly body: ApiError | null

  constructor(status: number, body: ApiError | null) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
    super(message ?? `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage unavailable: the session just won't survive a reload.
  }
}

let onUnauthorized: (() => void) | null = null

/** Called when an authenticated request gets 401 (expired or revoked token). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

/**
 * Fetches `/api<path>` (proxied to the NestJS API) with the stored Bearer token.
 * A FormData body is sent as multipart; anything else as JSON.
 */
export async function api<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  const isForm = options.body instanceof FormData
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
  })

  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.()
    const body = (await res.json().catch(() => null)) as ApiError | null
    throw new ApiRequestError(res.status, body)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
