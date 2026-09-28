import type { Club } from '@padel/shared'
import {
  Building,
  Camera,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Menu,
  RectangleHorizontal,
  Tv,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { LANGUAGES, setLanguage } from '../i18n'
import { useAuth } from '../lib/auth-context'
import { useActiveClub } from '../lib/club-context'
import { BrandMark } from './brand'
import { EmptyState, Loading } from './ui'

const NAV: {
  to: string
  key: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
  superAdminOnly?: boolean
}[] = [
  { to: '/', key: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/courts', key: 'nav.courts', icon: RectangleHorizontal },
  { to: '/cameras', key: 'nav.cameras', icon: Camera },
  { to: '/players', key: 'nav.players', icon: UserRound },
  { to: '/tv-setup', key: 'nav.tv', icon: Tv },
  { to: '/clubs', key: 'nav.clubs', icon: Building, superAdminOnly: true },
  { to: '/users', key: 'nav.users', icon: Users, superAdminOnly: true },
]

/** App shell: dark sidebar on desktop, slide-over drawer on mobile. */
export function Layout() {
  const { t } = useTranslation()
  const { club, isLoading } = useActiveClub()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  // Platform pages (clubs, users) work without an active club, e.g. before the first club exists.
  const needsClub = !['/clubs', '/users'].some((p) => location.pathname.startsWith(p))
  useLockBodyScroll(drawerOpen)

  // Close the drawer after navigating.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname)
    setDrawerOpen(false)
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="-ml-1 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label={t('nav.menu')}
        >
          <Menu className="h-5 w-5" />
        </button>
        <BrandMark className="h-7 w-7" />
        <span className="font-semibold tracking-tight">{t('app.name')}</span>
        {club && <span className="ml-auto truncate text-sm text-slate-500">{club.name}</span>}
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-68">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {isLoading ? (
            <Loading label={t('common.loading')} />
          ) : club || !needsClub ? (
            <Outlet context={club} />
          ) : (
            <EmptyState>
              {t('errors.noClub')}
              {isSuperAdmin && (
                <>
                  {' '}
                  <Link to="/clubs" className="font-medium text-emerald-700 hover:underline">
                    {t('clubs.add')}
                  </Link>
                </>
              )}
            </EmptyState>
          )}
        </div>
      </main>
    </div>
  )
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const displayName = user?.name ?? user?.username ?? user?.email ?? ''

  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-ink-950 text-slate-300">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_60%_at_20%_0%,rgba(16,185,129,0.18),transparent)]" />

      <div className="relative flex items-center gap-3 px-6 pt-6 pb-5">
        <BrandMark className="h-9 w-9" />
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight text-white">{t('app.name')}</p>
          <p className="text-xs text-slate-500">{t('app.by')}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label={t('nav.close')}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="relative px-4">
        <ClubSwitcher />
      </div>

      <nav className="relative mt-6 flex-1 space-y-1 px-4">
        {NAV.filter((item) => !item.superAdminOnly || user?.role === 'SUPER_ADMIN').map(({ to, key, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute top-2 bottom-2 -left-4 w-1 rounded-r-full bg-emerald-400" />}
                <Icon
                  className={`h-[18px] w-[18px] ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                />
                {t(key)}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative space-y-3 border-t border-white/[0.06] p-4">
        <div className="flex items-center justify-between px-2 text-xs text-slate-500">
          <span>{t('nav.language')}</span>
          <div className="flex rounded-lg bg-white/[0.06] p-0.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`rounded-md px-2 py-0.5 font-semibold ${
                  i18n.language === lang ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(`lang.${lang}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
          <Avatar name={displayName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{user && t(`roles.${user.role}`)}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title={t('nav.logout')}
            aria-label={t('nav.logout')}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Active club; SUPER_ADMIN can switch between clubs. */
function ClubSwitcher() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { club, clubs, selectClub } = useActiveClub()
  if (!club) return null
  const canSwitch = user?.role === 'SUPER_ADMIN' && clubs.length > 1

  return (
    <div className="relative flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.04] p-2.5 transition hover:bg-white/[0.06]">
      <ClubLogo club={club} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{t('common.club')}</p>
        <p className="truncate text-sm font-semibold text-white">{club.name}</p>
      </div>
      {canSwitch && (
        <>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-500" />
          {/* Native select laid over the card: accessible and works on every device. */}
          <select
            aria-label={t('common.club')}
            value={club.id}
            onChange={(e) => selectClub(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  )
}

function ClubLogo({ club }: { club: Club }) {
  if (club.logoUrl) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1">
        <img src={club.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
      </span>
    )
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white">
      {initials(club.name)}
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-xs font-semibold text-white ring-2 ring-white/10">
      {initials(name)}
    </span>
  )
}

function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/)
  const first = parts[0] ?? ''
  const second = parts.length > 1 ? parts[parts.length - 1][0] : first[1]
  return ((first[0] ?? '') + (second ?? '')).toUpperCase()
}

/** Keeps the page behind the mobile drawer from scrolling. */
function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}
