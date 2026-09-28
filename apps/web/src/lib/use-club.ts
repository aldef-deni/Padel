import type { Club } from '@padel/shared'
import { useOutletContext } from 'react-router'

/** The active club, provided by Layout to every page. */
export function useClub() {
  return useOutletContext<Club>()
}
