import { createBrowserRouter, Navigate } from 'react-router'
import { Layout } from './components/Layout'
import { RequireAdmin } from './components/RequireAdmin'
import { CamerasPage } from './pages/CamerasPage'
import { CourtDetailPage } from './pages/CourtDetailPage'
import { CourtsPage } from './pages/CourtsPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { SessionPage } from './pages/SessionPage'
import { TvPage } from './pages/TvPage'
import { TvSetupPage } from './pages/TvSetupPage'
import { UsersPage } from './pages/UsersPage'
import { PlayersPage } from './pages/PlayersPage'
import { ProfilePage } from './pages/ProfilePage'
import { ClubsPage } from './pages/ClubsPage'
import { ClubDetailPage } from './pages/ClubDetailPage'
import { RequireSuperAdmin } from './components/RequireSuperAdmin'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Kiosk: authorized by the TV link key, no login and no admin layout.
  { path: '/tv/:clubId', element: <TvPage /> },
  {
    element: <RequireAdmin />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'courts', element: <CourtsPage /> },
          { path: 'courts/:courtId', element: <CourtDetailPage /> },
          { path: 'courts/:courtId/session', element: <SessionPage /> },
          { path: 'cameras', element: <CamerasPage /> },
          { path: 'players', element: <PlayersPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'tv-setup', element: <TvSetupPage /> },
          {
            element: <RequireSuperAdmin />,
            children: [
              { path: 'clubs', element: <ClubsPage /> },
              { path: 'clubs/:clubId', element: <ClubDetailPage /> },
              { path: 'users', element: <UsersPage /> },
            ],
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
