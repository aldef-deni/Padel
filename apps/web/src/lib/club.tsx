import { useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth-context'
import { ActiveClubContext, type ActiveClubValue } from './club-context'
import { useClubs } from './queries'

const STORAGE_KEY = 'padel.clubId'

export function ActiveClubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  // The API already limits a CLUB_ADMIN to their own club.
  const clubsQuery = useClubs(!!user)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })

  const value = useMemo<ActiveClubValue>(() => {
    const clubs = clubsQuery.data ?? []
    const club =
      clubs.find((c) => c.id === (user?.role === 'CLUB_ADMIN' ? user.clubId : selectedId)) ??
      clubs[0] ??
      null
    return {
      club,
      clubs,
      isLoading: clubsQuery.isPending,
      selectClub: (id) => {
        setSelectedId(id)
        try {
          localStorage.setItem(STORAGE_KEY, id)
        } catch {
          // Ignore: selection just won't persist.
        }
      },
    }
  }, [clubsQuery.data, clubsQuery.isPending, selectedId, user])

  return <ActiveClubContext value={value}>{children}</ActiveClubContext>
}
