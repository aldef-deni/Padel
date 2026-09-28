import type { Club } from '@padel/shared'
import { clubInitials } from '../lib/clubs'

/** Club logo on a white tile, or initials when there is no logo. */
export function ClubAvatar({ club, className = 'h-12 w-12 text-base' }: {
  club: Pick<Club, 'name' | 'logoUrl'> & { isActive?: boolean }
  className?: string
}) {
  if (club.logoUrl) {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5`}
      >
        <img src={club.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
      </span>
    )
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-xl font-bold text-white ${
        club.isActive !== false ? 'bg-gradient-to-br from-emerald-400 to-teal-600' : 'bg-slate-300'
      }`}
    >
      {clubInitials(club.name)}
    </span>
  )
}
