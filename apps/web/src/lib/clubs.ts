import type { TFunction } from 'i18next'
import { ApiRequestError } from './api'
import { errorMessage } from './errors'

export const TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB · Asia/Jakarta' },
  { value: 'Asia/Makassar', label: 'WITA · Asia/Makassar' },
  { value: 'Asia/Jayapura', label: 'WIT · Asia/Jayapura' },
]

/** "Padel Arena Jakarta" -> "padel-arena-jakarta" */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Maps API errors of the club endpoints to UI text. */
export function clubErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiRequestError) {
    const message = error.message
    if (error.status === 409) {
      const m = /(\d+) court\(s\) and (\d+) admin\(s\)/.exec(message)
      if (m) return t('clubs.errors.notEmpty', { courts: m[1], admins: m[2] })
      return t('clubs.errors.slugTaken')
    }
    if (error.status === 413) return t('clubs.errors.logoSize')
    if (error.status === 400) {
      if (/Logo must be/i.test(message)) return t('clubs.errors.logoType')
      if (/Time must be|openTime|closeTime/i.test(message)) return t('clubs.errors.time')
      if (/website|mapsUrl/i.test(message)) return t('clubs.errors.url')
      if (/phone must be/i.test(message)) return t('clubs.errors.phone')
      if (/instagram/i.test(message)) return t('clubs.errors.instagram')
    }
  }
  return errorMessage(error, t)
}

export function instagramUrl(handle: string) {
  return `https://instagram.com/${handle}`
}

export function clubInitials(name: string) {
  const words = name.trim().split(/\s+/)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : (words[0]?.[1] ?? ''))).toUpperCase()
}
