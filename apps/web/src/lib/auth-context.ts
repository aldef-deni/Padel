import type { AdminLoginInput, User } from '@padel/shared'
import { createContext, useContext } from 'react'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (input: AdminLoginInput) => Promise<User>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const meQueryKey = ['auth', 'me'] as const

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
