import type { Club } from '@padel/shared'
import { createContext, useContext } from 'react'

export interface ActiveClubValue {
  /** Club being managed; null while loading or when the account has none. */
  club: Club | null
  clubs: Club[]
  isLoading: boolean
  /** SUPER_ADMIN only: switch between clubs. */
  selectClub: (id: string) => void
}

export const ActiveClubContext = createContext<ActiveClubValue | null>(null)

export function useActiveClub() {
  const ctx = useContext(ActiveClubContext)
  if (!ctx) throw new Error('useActiveClub must be used inside ActiveClubProvider')
  return ctx
}
