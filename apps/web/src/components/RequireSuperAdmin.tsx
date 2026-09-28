import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../lib/auth-context'

/** Pages only a SUPER_ADMIN may open; others land on the dashboard (the API enforces it too). */
export function RequireSuperAdmin() {
  const { user } = useAuth()
  if (user?.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}
