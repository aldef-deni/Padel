import { initials } from '../lib/users'

const tones = {
  emerald: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
  sky: 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white',
  amber: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white',
  slate: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white',
  muted: 'bg-slate-200 text-slate-500',
}

/** Round profile photo, or initials when there is none. */
export function UserAvatar({
  name,
  url,
  className = 'h-9 w-9 text-xs',
  tone = 'emerald',
}: {
  name: string
  url: string | null | undefined
  className?: string
  tone?: keyof typeof tones
}) {
  if (url) {
    return <img src={url} alt="" className={`${className} shrink-0 rounded-full bg-slate-100 object-cover`} />
  }
  return (
    <span className={`${className} ${tones[tone]} flex shrink-0 items-center justify-center rounded-full font-semibold`}>
      {initials(name)}
    </span>
  )
}
