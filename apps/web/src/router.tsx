import { createBrowserRouter, Navigate } from 'react-router'
import { Layout } from './components/Layout'
import { RequireAdmin } from './components/RequireAdmin'
import { CamerasPage } from './pages/CamerasPage'
import { CourtDetailPage } from './pages/CourtDetailPage'
import { CourtsPage } from './pages/CourtsPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAdmin />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'courts', element: <CourtsPage /> },
          { path: 'courts/:courtId', element: <CourtDetailPage /> },
          { path: 'cameras', element: <CamerasPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])
