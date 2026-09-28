import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { LANGUAGES, setLanguage, type Language } from '../i18n'
import { useAuth } from '../lib/auth-context'
import { useActiveClub } from '../lib/club-context'
import { EmptyState, Loading } from './ui'

export function Layout() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const { club, clubs, isLoading, selectClub } = useActiveClub()

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${
      isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="font-semibold">{t('app.name')}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{t('app.admin')}</span>
          </div>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navClass}>
              {t('nav.dashboard')}
            </NavLink>
            <NavLink to="/courts" className={navClass}>
              {t('nav.courts')}
            </NavLink>
            <NavLink to="/cameras" className={navClass}>
              {t('nav.cameras')}
            </NavLink>
            <NavLink to="/tv-setup" className={navClass}>
              {t('nav.tv')}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {user?.role === 'SUPER_ADMIN' && clubs.length > 0 ? (
              <select
                aria-label={t('common.club')}
                value={club?.id ?? ''}
                onChange={(e) => selectClub(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              club && <span className="font-medium text-slate-700">{club.name}</span>
            )}
            <div className="flex overflow-hidden rounded-lg border border-slate-300">
              {LANGUAGES.map((lang: Language) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`px-2 py-1 text-xs font-medium ${
                    i18n.language === lang ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t(`lang.${lang}`)}
                </button>
              ))}
            </div>
            <span className="hidden text-slate-500 sm:inline">{user?.email}</span>
            <button type="button" onClick={logout} className="text-slate-600 hover:text-slate-900">
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {isLoading ? (
          <Loading label={t('common.loading')} />
        ) : club ? (
          <Outlet context={club} />
        ) : (
          <EmptyState>{t('errors.noClub')}</EmptyState>
        )}
      </main>
    </div>
  )
}
