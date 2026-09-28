import type { Camera, CameraStatus, Court } from '@padel/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { StatusBadge } from '../components/StatusBadge'
import { cameraState, videoLabel } from '../lib/camera-state'
import { Button, Card, EmptyState, ErrorText, Field, Input, Loading, PageHeader, Select } from '../components/ui'
import { errorMessage } from '../lib/errors'
import {
  useCameras,
  useCameraStatus,
  useCourts,
  useCreateCamera,
  useDeleteCamera,
  useUpdateCamera,
} from '../lib/queries'
import { useClub } from '../lib/use-club'

const STREAM_PATH_PATTERN = '^court-[0-9a-z\\-]+$'

export function CamerasPage() {
  const { t } = useTranslation()
  const club = useClub()
  const courts = useCourts(club.id)
  const cameras = useCameras(club.id)
  const status = useCameraStatus(club.id)

  if (courts.isPending || cameras.isPending) return <Loading label={t('common.loading')} />
  if (courts.error || cameras.error) return <ErrorText>{errorMessage(courts.error ?? cameras.error, t)}</ErrorText>

  const statusById = new Map<string, CameraStatus>(status.data?.cameras.map((s) => [s.cameraId, s]))

  return (
    <>
      <PageHeader title={t('cameras.title')} />
      {courts.data.length === 0 ? (
        <EmptyState>
          {t('cameras.needCourt')}{' '}
          <Link to="/courts" className="font-medium text-emerald-700 hover:underline">
            {t('dashboard.addCourt')}
          </Link>
        </EmptyState>
      ) : (
        <>
          <CreateCameraForm clubId={club.id} courts={courts.data} />
          {cameras.data.length === 0 ? (
            <EmptyState>{t('cameras.empty')}</EmptyState>
          ) : (
            <>
            {status.data && (
              <p className="mb-3 flex items-start gap-2 text-sm text-slate-500">
                <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
                {t('cameras.recordingSummary', {
                  active: status.data.cameras.filter((c) => c.recording.active).length,
                  total: status.data.cameras.length,
                  hours: status.data.recordRetentionHours,
                })}
              </p>
            )}
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('common.name')}</th>
                    <th className="px-4 py-3 font-medium">{t('cameras.court')}</th>
                    <th className="px-4 py-3 font-medium">{t('cameras.streamPath')}</th>
                    <th className="px-4 py-3 font-medium">{t('cameras.status')}</th>
                    <th className="px-4 py-3 font-medium">{t('cameras.active')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cameras.data.map((camera) => (
                    <CameraRow
                      key={camera.id}
                      camera={camera}
                      courts={courts.data}
                      clubId={club.id}
                      status={statusById.get(camera.id)}
                      reachable={status.data?.mediaServerReachable}
                    />
                  ))}
                </tbody>
              </table>
            </Card>
            </>
          )}
        </>
      )}
    </>
  )
}

function CreateCameraForm({ clubId, courts }: { clubId: string; courts: Court[] }) {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const createCamera = useCreateCamera(clubId)
  const initialCourt = courts.find((c) => c.id === searchParams.get('courtId'))?.id ?? courts[0].id
  const [courtId, setCourtId] = useState(initialCourt)
  const [name, setName] = useState('')
  const [streamPath, setStreamPath] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    createCamera.mutate(
      { courtId, name: name.trim(), streamPath: streamPath.trim() },
      {
        onSuccess: () => {
          setName('')
          setStreamPath('')
        },
      },
    )
  }

  return (
    <Card className="mb-6 p-4">
      <h2 className="mb-3 font-medium">{t('cameras.add')}</h2>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-start">
        <Field label={t('cameras.court')}>
          <Select value={courtId} onChange={(e) => setCourtId(e.target.value)}>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.name')}>
          <Input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('cameras.streamPath')} hint={t('cameras.streamPathHint')}>
          <Input
            required
            maxLength={64}
            pattern={STREAM_PATH_PATTERN}
            placeholder="court-4"
            className="font-mono"
            value={streamPath}
            onChange={(e) => setStreamPath(e.target.value.toLowerCase())}
          />
        </Field>
        <Button type="submit" className="sm:mt-6" disabled={createCamera.isPending}>
          {t('common.add')}
        </Button>
      </form>
      {createCamera.error && (
        <div className="mt-3">
          <ErrorText>{errorMessage(createCamera.error, t)}</ErrorText>
        </div>
      )}
    </Card>
  )
}

function CameraRow({
  camera,
  courts,
  clubId,
  status,
  reachable,
}: {
  camera: Camera
  courts: Court[]
  clubId: string
  status: CameraStatus | undefined
  reachable: boolean | undefined
}) {
  const { t } = useTranslation()
  const updateCamera = useUpdateCamera(clubId)
  const deleteCamera = useDeleteCamera(clubId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: camera.name, streamPath: camera.streamPath, courtId: camera.courtId })
  const error = updateCamera.error ?? deleteCamera.error
  const courtName = courts.find((c) => c.id === camera.courtId)?.name ?? '—'
  const label = videoLabel(status)
  // Optimistic: show the value being saved until the refetch lands.
  const pendingActive = updateCamera.isPending ? updateCamera.variables?.isActive : undefined
  const isActive = pendingActive ?? camera.isActive

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    updateCamera.mutate(
      { id: camera.id, name: draft.name.trim(), streamPath: draft.streamPath.trim(), courtId: draft.courtId },
      { onSuccess: () => setEditing(false) },
    )
  }

  const onDelete = () => {
    if (window.confirm(t('common.confirmDelete', { name: camera.name }))) deleteCamera.mutate(camera.id)
  }

  const formId = `camera-${camera.id}`

  return (
    <>
      <tr className="align-middle">
        {editing ? (
          <>
            <td className="px-4 py-2">
              <Input
                form={formId}
                required
                maxLength={100}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </td>
            <td className="px-4 py-2">
              <Select form={formId} value={draft.courtId} onChange={(e) => setDraft({ ...draft, courtId: e.target.value })}>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </td>
            <td className="px-4 py-2">
              <Input
                form={formId}
                required
                maxLength={64}
                pattern={STREAM_PATH_PATTERN}
                className="font-mono"
                value={draft.streamPath}
                onChange={(e) => setDraft({ ...draft, streamPath: e.target.value.toLowerCase() })}
              />
            </td>
          </>
        ) : (
          <>
            <td className="px-4 py-3 font-medium">{camera.name}</td>
            <td className="px-4 py-3">
              <Link to={`/courts/${camera.courtId}`} className="hover:text-emerald-700">
                {courtName}
              </Link>
            </td>
            <td className="px-4 py-3 font-mono text-xs">{camera.streamPath}</td>
          </>
        )}
        <td className="px-4 py-3">
          <div className="flex flex-col items-start gap-1">
            <StatusBadge state={cameraState(isActive, status, reachable)} />
            {label && <span className="text-xs text-slate-500">{label}</span>}
            {status && <RecordingLine recording={status.recording} />}
          </div>
        </td>
        <td className="px-4 py-3">
          <input
            type="checkbox"
            aria-label={t('cameras.active')}
            className="h-4 w-4 accent-emerald-600"
            checked={isActive}
            disabled={updateCamera.isPending}
            onChange={(e) => updateCamera.mutate({ id: camera.id, isActive: e.target.checked })}
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1">
            {editing ? (
              <form id={formId} onSubmit={onSave} className="flex gap-1">
                <Button type="submit" disabled={updateCamera.isPending}>
                  {t('common.save')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false)
                    setDraft({ name: camera.name, streamPath: camera.streamPath, courtId: camera.courtId })
                    updateCamera.reset()
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </form>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setEditing(true)}>
                  {t('common.edit')}
                </Button>
                <Button variant="danger" onClick={onDelete} disabled={deleteCamera.isPending}>
                  {t('common.delete')}
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={6} className="px-4 pb-3">
            <ErrorText>{errorMessage(error, t)}</ErrorText>
          </td>
        </tr>
      )}
    </>
  )
}

/** "● Merekam · replay tersedia sejak 14:05" under the camera status. */
function RecordingLine({ recording }: { recording: CameraStatus['recording'] }) {
  const { t, i18n } = useTranslation()
  const since = recording.availableFrom
    ? new Date(recording.availableFrom).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <span className={`flex items-center gap-1.5 text-xs ${recording.active ? 'text-red-600' : 'text-slate-400'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${recording.active ? 'animate-pulse bg-red-500' : 'bg-slate-300'}`} />
      {recording.active ? t('cameras.recording') : t('cameras.notRecording')}
      {since && <span className="text-slate-500">· {t('cameras.recordedSince', { time: since })}</span>}
    </span>
  )
}
