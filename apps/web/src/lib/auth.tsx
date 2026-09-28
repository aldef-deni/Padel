import type { AdminLoginInput, AuthResponse, User } from '@padel/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from './api'
import { AuthContext, meQueryKey, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setTokenState] = useState(getToken)

  const logout = useCallback(() => {
    setToken(null)
    setTokenState(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const me = useQuery({
    queryKey: meQueryKey,
    queryFn: () => api<User>('/auth/me'),
    enabled: !!token,
    staleTime: 5 * 60_000,
  })

  const login = useCallback(
    async (input: AdminLoginInput) => {
      const res = await api<AuthResponse>('/auth/admin/login', { method: 'POST', body: input })
      setToken(res.accessToken)
      setTokenState(res.accessToken)
      queryClient.setQueryData(meQueryKey, res.user)
      return res.user
    },
    [queryClient],
  )

  const setSession = useCallback(
    (res: AuthResponse) => {
      setToken(res.accessToken)
      setTokenState(res.accessToken)
      queryClient.setQueryData(meQueryKey, res.user)
    },
    [queryClient],
  )
  const updateUser = useCallback((u: User) => queryClient.setQueryData(meQueryKey, u), [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: token ? (me.data ?? null) : null,
      isLoading: !!token && me.isPending,
      login,
      logout,
      setSession,
      updateUser,
    }),
    [token, me.data, me.isPending, login, logout, setSession, updateUser],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
