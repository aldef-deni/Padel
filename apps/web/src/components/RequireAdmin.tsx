import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { ActiveClubProvider } from '../lib/club'
import { Button, Card, Loading } from './ui'

/** Only signed-in admins get past this; players are turned away. */
export function RequireAdmin() {
  const { t } = useTranslation()
  const { user, isLoading, logout } = useAuth()
  const location = useLocation()

  if (isLoading) return <Loading label={t('common.loading')} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (user.role === 'PLAYER') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-sm space-y-4 p-6 text-center">
          <p className="text-sm text-slate-600">{t('errors.playerAccount')}</p>
          <Button variant="secondary" onClick={logout}>
            {t('nav.logout')}
          </Button>
        </Card>
      </div>
    )
  }
  return (
    <ActiveClubProvider>
      <Outlet />
    </ActiveClubProvider>
  )
}
