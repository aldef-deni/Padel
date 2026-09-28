import type { Role } from '@padel/shared'
import type { TFunction } from 'i18next'
import { ApiRequestError } from './api'
import { errorMessage } from './errors'

/** Maps API errors of the users endpoints to UI text. */
export function userErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiRequestError) {
    const message = error.message
    if (error.status === 409) {
      if (/deactivate/i.test(message)) return t('users.errors.hasClips')
      if (/last active super admin/i.test(message)) return t('users.errors.lastSuperAdmin')
      return t('users.errors.duplicate')
    }
    if (error.status === 400) {
      if (/your own/i.test(message)) return t('users.errors.self')
      if (/phone must be/i.test(message)) return t('users.errors.phoneInvalid')
      if (/username must be/i.test(message)) return t('users.errors.usernameInvalid')
    }
  }
  return errorMessage(error, t)
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** 16 random characters without look-alikes (0/O, 1/l/I). */
export function generatePassword(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join('')
}

export const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/

export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/)
  const first = parts[0] ?? ''
  const second = parts.length > 1 ? parts[parts.length - 1][0] : first[1]
  return ((first[0] ?? '') + (second ?? '')).toUpperCase()
}

export const roleBadge: Record<Role, string> = {
  SUPER_ADMIN: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  CLUB_ADMIN: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  PLAYER: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}
