/** "2 menit lalu" / "2 minutes ago" in the UI language. */
export function relativeTime(iso: string, lang: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(seconds, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return rtf.format(Math.round(seconds / 86_400), 'day')
}

export type DayPart = 'Morning' | 'Afternoon' | 'Evening' | 'Night'

/** Indonesian-style day parts: pagi < 11, siang < 15, sore < 18, malam. */
export function dayPart(date = new Date()): DayPart {
  const h = date.getHours()
  if (h >= 4 && h < 11) return 'Morning'
  if (h >= 11 && h < 15) return 'Afternoon'
  if (h >= 15 && h < 18) return 'Evening'
  return 'Night'
}

/** "12,4 MB" in the UI language. */
export function formatBytes(bytes: number, lang: string): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`
}
