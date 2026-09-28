import type { CameraStatus } from '@padel/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { StatusBadge } from '../components/StatusBadge'
import { cameraState, videoLabel } from '../lib/camera-state'
import { Card, EmptyState, ErrorText, Loading, PageHeader } from '../components/ui'
import { errorMessage } from '../lib/errors'
import { useCameras, useCameraStatus, useCourts } from '../lib/queries'
import { useClub } from '../lib/use-club'

export function DashboardPage() {
  const { t } = useTranslation()
  const club = useClub()
  const courts = useCourts(club.id)
  const cameras = useCameras(club.id)
  const status = useCameraStatus(club.id)

  if (courts.isPending || cameras.isPending) return <Loading label={t('common.loading')} />
  if (courts.error || cameras.error) return <ErrorText>{errorMessage(courts.error ?? cameras.error, t)}</ErrorText>

  const statusById = new Map<string, CameraStatus>(status.data?.cameras.map((s) => [s.cameraId, s]))
  const reachable = status.data?.mediaServerReachable
  const onlineCount = cameras.data.filter(
    (c) => cameraState(c.isActive, statusById.get(c.id), reachable) === 'online',
  ).length

  return (
    <>
      <PageHeader title={t('dashboard.title')} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Stat label={t('dashboard.courts')} value={courts.data.length} />
        <Stat label={t('dashboard.camerasOnline')} value={`${onlineCount} / ${cameras.data.length}`} />
      </div>

      {reachable === false && (
        <div className="mb-6">
          <ErrorText>{t('status.mediaUnreachable')}</ErrorText>
        </div>
      )}

      {courts.data.length === 0 ? (
        <EmptyState>
          {t('dashboard.noCourts')}{' '}
          <Link to="/courts" className="font-medium text-emerald-700 hover:underline">
            {t('dashboard.addCourt')}
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courts.data.map((court) => {
            const courtCameras = cameras.data.filter((c) => c.courtId === court.id)
            return (
              <Card key={court.id} className="flex flex-col p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{court.name}</h2>
                  <Link
                    to={`/courts/${court.id}`}
                    className="shrink-0 text-sm font-medium text-emerald-700 hover:underline"
                  >
                    {t('dashboard.watchLive')} →
                  </Link>
                </div>
                {courtCameras.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('dashboard.noCameras')}</p>
                ) : (
                  <ul className="space-y-2">
                    {courtCameras.map((camera) => {
                      const s = statusById.get(camera.id)
                      const label = videoLabel(s)
                      return (
                        <li key={camera.id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate">{camera.name}</p>
                            <p className="truncate font-mono text-xs text-slate-500">
                              {camera.streamPath}
                              {label && ` · ${label}`}
                            </p>
                          </div>
                          <StatusBadge state={cameraState(camera.isActive, s, reachable)} />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-slate-400">{t('dashboard.autoRefresh')}</p>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  )
}
