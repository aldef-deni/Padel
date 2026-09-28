import type { Court } from '@padel/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button, Card, EmptyState, ErrorText, Input, Loading, PageHeader } from '../components/ui'
import { errorMessage } from '../lib/errors'
import { useCameras, useCourts, useCreateCourt, useDeleteCourt, useUpdateCourt } from '../lib/queries'
import { useClub } from '../lib/use-club'

export function CourtsPage() {
  const { t } = useTranslation()
  const club = useClub()
  const courts = useCourts(club.id)
  const cameras = useCameras(club.id)
  const createCourt = useCreateCourt(club.id)
  const [name, setName] = useState('')

  const onCreate = (e: FormEvent) => {
    e.preventDefault()
    createCourt.mutate({ clubId: club.id, name: name.trim() }, { onSuccess: () => setName('') })
  }

  return (
    <>
      <PageHeader title={t('courts.title')} />

      <Card className="mb-6 p-4">
        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 space-y-1">
            <span className="text-sm font-medium text-slate-700">{t('courts.add')}</span>
            <Input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('courts.namePlaceholder')}
            />
          </label>
          <Button type="submit" disabled={createCourt.isPending || !name.trim()}>
            {t('common.add')}
          </Button>
        </form>
        {createCourt.error && (
          <div className="mt-3">
            <ErrorText>{errorMessage(createCourt.error, t)}</ErrorText>
          </div>
        )}
      </Card>

      {courts.isPending ? (
        <Loading label={t('common.loading')} />
      ) : courts.error ? (
        <ErrorText>{errorMessage(courts.error, t)}</ErrorText>
      ) : courts.data.length === 0 ? (
        <EmptyState>{t('courts.empty')}</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {courts.data.map((court) => (
              <CourtRow
                key={court.id}
                court={court}
                clubId={club.id}
                cameraCount={cameras.data?.filter((c) => c.courtId === court.id).length ?? 0}
              />
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function CourtRow({ court, clubId, cameraCount }: { court: Court; clubId: string; cameraCount: number }) {
  const { t } = useTranslation()
  const updateCourt = useUpdateCourt(clubId)
  const deleteCourt = useDeleteCourt(clubId)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(court.name)
  const error = updateCourt.error ?? deleteCourt.error

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    updateCourt.mutate({ id: court.id, name: name.trim() }, { onSuccess: () => setEditing(false) })
  }

  const onDelete = () => {
    if (window.confirm(t('common.confirmDelete', { name: court.name }))) deleteCourt.mutate(court.id)
  }

  return (
    <li className="px-4 py-3">
      {editing ? (
        <form onSubmit={onSave} className="flex flex-wrap items-center gap-2">
          <Input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={updateCourt.isPending || !name.trim()}>
            {t('common.save')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(false)
              setName(court.name)
              updateCourt.reset()
            }}
          >
            {t('common.cancel')}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link to={`/courts/${court.id}`} className="font-medium hover:text-emerald-700">
              {court.name}
            </Link>
            <p className="text-sm text-slate-500">{t('courts.cameraCount', { count: cameraCount })}</p>
          </div>
          <div className="flex gap-1">
            <Link
              to={`/courts/${court.id}`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              {t('courts.open')}
            </Link>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
            <Button variant="danger" onClick={onDelete} disabled={deleteCourt.isPending}>
              {t('common.delete')}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <ErrorText>{errorMessage(error, t)}</ErrorText>
        </div>
      )}
    </li>
  )
}
