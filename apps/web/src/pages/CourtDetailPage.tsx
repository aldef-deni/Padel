import type { CameraStatus } from '@padel/shared'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { LivePlayer } from '../components/LivePlayer'
import { StatusBadge } from '../components/StatusBadge'
import { cameraState, videoLabel } from '../lib/camera-state'
import { Card, EmptyState, ErrorText, Loading, PageHeader } from '../components/ui'
import { publishUrls } from '../media/urls'
import { errorMessage } from '../lib/errors'
import { useCameras, useCameraStatus, useCourt } from '../lib/queries'
import { useClub } from '../lib/use-club'

export function CourtDetailPage() {
  const { t } = useTranslation()
  const { courtId = '' } = useParams()
  const club = useClub()
  const court = useCourt(courtId)
  const cameras = useCameras(club.id)
  const status = useCameraStatus(club.id)

  // Wait for the first status so players don't try to connect to offline cameras.
  if (court.isPending || cameras.isPending || status.isPending) return <Loading label={t('common.loading')} />
  if (court.error || cameras.error) return <ErrorText>{errorMessage(court.error ?? cameras.error, t)}</ErrorText>

  const courtCameras = cameras.data.filter((c) => c.courtId === court.data.id)
  const statusById = new Map<string, CameraStatus>(status.data?.cameras.map((s) => [s.cameraId, s]))
  const reachable = status.data?.mediaServerReachable

  return (
    <>
      <Link to="/" className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← {t('common.back')}
      </Link>
      <PageHeader
        title={court.data.name}
        actions={
          <Link
            to={`/cameras?courtId=${court.data.id}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('court.manageCameras')}
          </Link>
        }
      />

      {courtCameras.length === 0 ? (
        <EmptyState>{t('court.noCameras')}</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {courtCameras.map((camera) => {
            const s = statusById.get(camera.id)
            const state = cameraState(camera.isActive, s, reachable)
            const label = videoLabel(s)
            const urls = publishUrls(camera.streamPath)
            return (
              <section key={camera.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{camera.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {label && <span>{label}</span>}
                    {s?.online && <span>{t('status.viewers', { count: s.readers })}</span>}
                    <StatusBadge state={state} />
                  </div>
                </div>
                <LivePlayer
                  streamPath={camera.streamPath}
                  active={camera.isActive}
                  online={state === 'unknown' ? undefined : state === 'online'}
                />
                <Card className="p-3 text-xs">
                  <p className="mb-1 font-medium text-slate-700">{t('cameras.publishUrl')}</p>
                  <p className="break-all font-mono text-slate-600">{urls.rtmp}</p>
                  <p className="break-all font-mono text-slate-600">{urls.srt}</p>
                  <p className="mt-2 text-slate-500">{t('cameras.publishHint')}</p>
                </Card>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
