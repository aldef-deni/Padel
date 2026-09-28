import type { Club, Court } from '@padel/shared'
import {
  ArrowLeft,
  AtSign,
  Camera,
  Clapperboard,
  Clock,
  ExternalLink,
  Globe,
  ImagePlus,
  LayoutDashboard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Power,
  RectangleHorizontal,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import { useRef, useState, type ComponentType, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ClubAvatar } from '../components/ClubAvatar'
import { ClubFormDialog } from '../components/ClubFormDialog'
import { Modal } from '../components/Modal'
import { Button, Card, ErrorText, Loading } from '../components/ui'
import { UserFormDialog } from '../components/UserFormDialog'
import { useActiveClub } from '../lib/club-context'
import { clubErrorMessage, instagramUrl, TIMEZONES } from '../lib/clubs'
import { errorMessage } from '../lib/errors'
import { relativeTime } from '../lib/format'
import {
  useCameras,
  useClubDetail,
  useClubOverview,
  useCourts,
  useDeleteClub,
  useRemoveLogo,
  useUpdateClub,
  useUploadLogo,
  useUsers,
} from '../lib/queries'
import { initials } from '../lib/users'

export function ClubDetailPage() {
  const { t } = useTranslation()
  const { clubId = '' } = useParams()
  const club = useClubDetail(clubId)

  if (club.isPending) return <Loading label={t('common.loading')} />
  if (club.error) return <ErrorText>{errorMessage(club.error, t)}</ErrorText>
  return <ClubDetail club={club.data} />
}

function ClubDetail({ club }: { club: Club }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { selectClub } = useActiveClub()
  const courts = useCourts(club.id)
  const cameras = useCameras(club.id)
  const overview = useClubOverview(club.id)
  const admins = useUsers({ clubId: club.id, role: 'CLUB_ADMIN', pageSize: 50 })
  const update = useUpdateClub()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingAdmin, setAddingAdmin] = useState(false)

  const openInDashboard = (path: string) => {
    selectClub(club.id)
    navigate(path)
  }
  const toggleActive = () => {
    if (club.isActive && !window.confirm(t('clubs.confirmDeactivate', { name: club.name }))) return
    update.mutate({ id: club.id, isActive: !club.isActive })
  }

  const kpis: [ComponentType<{ className?: string }>, string, ReactNode][] = [
    [RectangleHorizontal, t('clubs.courts'), courts.data?.length ?? '–'],
    [Camera, t('clubs.cameras'), cameras.data?.length ?? '–'],
    [ShieldCheck, t('clubs.admins'), admins.data?.total ?? '–'],
    [Users, t('clubs.sessions'), overview.data?.activeSessions.length ?? '–'],
    [Clapperboard, t('clubs.todayReplays'), overview.data?.clipsToday.total ?? '–'],
  ]

  return (
    <>
      <Link to="/clubs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        {t('clubs.back')}
      </Link>

      <Card className="mb-6 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-ink-900 via-ink-800 to-emerald-900" />
        <div className="flex flex-col gap-5 px-6 pb-6 sm:flex-row sm:items-end">
          <LogoEditor club={club} />
          <div className="min-w-0 flex-1 sm:pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{club.name}</h1>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  club.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {club.isActive ? t('clubs.active') : t('clubs.inactive')}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-mono">/{club.slug}</span>
              {club.city && <> · {club.city}</>} ·{' '}
              {t('clubs.created', { date: new Date(club.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' }) })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openInDashboard('/')}>
              <LayoutDashboard className="h-4 w-4" />
              {t('clubs.switchTo')}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              {t('clubs.edit')}
            </Button>
            <Button variant={club.isActive ? 'danger' : 'secondary'} onClick={toggleActive} disabled={update.isPending}>
              <Power className="h-4 w-4" />
              {club.isActive ? t('clubs.deactivate') : t('clubs.activate')}
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(true)} aria-label={t('clubs.delete')} title={t('clubs.delete')}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
        {update.error && (
          <div className="px-6 pb-4">
            <ErrorText>{clubErrorMessage(update.error, t)}</ErrorText>
          </div>
        )}
      </Card>

      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([Icon, label, value]) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Icon className="h-4 w-4 text-slate-400" />
              {label}
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <ProfileCard club={club} onEdit={() => setEditing(true)} />

        <div className="space-y-6">
          <Card>
            <CardHeader
              title={t('clubs.adminsTitle')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setAddingAdmin(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  {t('clubs.addAdmin')}
                </Button>
              }
            />
            {admins.data && admins.data.items.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {admins.data.items.map((admin) => {
                  const name = admin.name ?? admin.username ?? admin.email ?? ''
                  return (
                    <li key={admin.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-[11px] font-semibold text-white">
                        {initials(name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[admin.username && `@${admin.username}`, admin.email].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        {admin.isActive
                          ? admin.lastLoginAt
                            ? relativeTime(admin.lastLoginAt, i18n.language)
                            : t('users.never')
                          : t('users.inactive')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-slate-500">{admins.isPending ? t('common.loading') : t('clubs.noAdmins')}</p>
            )}
          </Card>

          <Card>
            <CardHeader
              title={t('clubs.courtsTitle')}
              action={
                <Button variant="secondary" size="sm" onClick={() => openInDashboard('/courts')}>
                  {t('clubs.manageCourts')}
                </Button>
              }
            />
            <CourtList courts={courts.data} cameraCount={(id) => cameras.data?.filter((c) => c.courtId === id).length ?? 0} />
          </Card>
        </div>
      </div>

      {editing && <ClubFormDialog club={club} onClose={() => setEditing(false)} />}
      {addingAdmin && (
        <UserFormDialog
          user={null}
          preset={{ role: 'CLUB_ADMIN', clubId: club.id }}
          onClose={() => setAddingAdmin(false)}
        />
      )}
      {deleting && <DeleteClubDialog club={club} onClose={() => setDeleting(false)} onDeleted={() => navigate('/clubs')} />}
    </>
  )
}

function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
      <h2 className="font-semibold tracking-tight text-slate-900">{title}</h2>
      {action}
    </div>
  )
}

function CourtList({ courts, cameraCount }: { courts: Court[] | undefined; cameraCount: (courtId: string) => number }) {
  const { t } = useTranslation()
  if (!courts) return <p className="px-5 pb-5 text-sm text-slate-500">{t('common.loading')}</p>
  if (courts.length === 0) return <p className="px-5 pb-5 text-sm text-slate-500">{t('clubs.noCourts')}</p>
  return (
    <ul className="divide-y divide-slate-100">
      {courts.map((court) => (
        <li key={court.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
          <span className="flex items-center gap-2.5 font-medium text-slate-800">
            <RectangleHorizontal className="h-4 w-4 text-slate-400" />
            {court.name}
          </span>
          <span className="text-xs text-slate-500">{t('clubs.camerasCount', { count: cameraCount(court.id) })}</span>
        </li>
      ))}
    </ul>
  )
}

function ProfileCard({ club, onEdit }: { club: Club; onEdit: () => void }) {
  const { t } = useTranslation()
  const tz = TIMEZONES.find((z) => z.value === club.timezone)?.label ?? club.timezone
  const rows: { icon: ComponentType<{ className?: string }>; label: string; value: ReactNode }[] = []
  if (club.address || club.mapsUrl) {
    rows.push({
      icon: MapPin,
      label: t('clubs.address'),
      value: (
        <>
          {club.address}
          {club.mapsUrl && (
            <a href={club.mapsUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-emerald-700 hover:underline">
              Maps <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </>
      ),
    })
  }
  if (club.openTime && club.closeTime) {
    rows.push({ icon: Clock, label: t('clubs.sectionOps'), value: `${club.openTime}–${club.closeTime} · ${tz}` })
  } else {
    rows.push({ icon: Clock, label: t('clubs.timezone'), value: tz })
  }
  if (club.phone) {
    rows.push({
      icon: Phone,
      label: t('clubs.phone'),
      value: (
        <a href={`https://wa.me/${club.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
          {club.phone}
        </a>
      ),
    })
  }
  if (club.email) {
    rows.push({
      icon: Mail,
      label: t('clubs.email'),
      value: (
        <a href={`mailto:${club.email}`} className="text-emerald-700 hover:underline">
          {club.email}
        </a>
      ),
    })
  }
  if (club.website) {
    rows.push({
      icon: Globe,
      label: t('clubs.website'),
      value: (
        <a href={club.website} target="_blank" rel="noreferrer" className="break-all text-emerald-700 hover:underline">
          {club.website.replace(/^https?:\/\//, '')}
        </a>
      ),
    })
  }
  if (club.instagram) {
    rows.push({
      icon: AtSign,
      label: t('clubs.instagram'),
      value: (
        <a href={instagramUrl(club.instagram)} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
          @{club.instagram}
        </a>
      ),
    })
  }

  return (
    <Card>
      <CardHeader
        title={t('clubs.profile')}
        action={
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            {t('clubs.edit')}
          </Button>
        }
      />
      <div className="px-5 pb-5">
        {club.description && <p className="mb-4 text-sm leading-relaxed text-slate-600">{club.description}</p>}
        <dl className="space-y-3">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex gap-3 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-slate-800">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
        {rows.length <= 1 && !club.description && <p className="mt-4 text-sm text-slate-400">{t('clubs.noProfile')}</p>}
      </div>
    </Card>
  )
}

/** Club logo with upload / remove controls (PNG, JPEG, WebP, max 1 MB). */
function LogoEditor({ club }: { club: Club }) {
  const { t } = useTranslation()
  const upload = useUploadLogo(club.id)
  const remove = useRemoveLogo(club.id)
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className="-mt-10 flex flex-col items-start gap-2">
      <div className="group relative rounded-2xl bg-white p-1 shadow-lg shadow-slate-900/10">
        <ClubAvatar club={club} className="h-24 w-24 text-2xl" />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={upload.isPending}
          className="absolute inset-1 flex items-center justify-center rounded-xl bg-ink-950/60 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
          title={t('clubs.uploadLogo')}
          aria-label={t('clubs.uploadLogo')}
        >
          <ImagePlus className="h-6 w-6" />
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label={t('clubs.uploadLogo')}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate(file)
          e.target.value = ''
        }}
      />
      {club.logoUrl && (
        <button type="button" onClick={() => remove.mutate()} className="text-xs text-slate-400 hover:text-red-600">
          {t('clubs.removeLogo')}
        </button>
      )}
      {(upload.error ?? remove.error) && (
        <p className="max-w-40 text-xs text-red-600">{errorMessage(upload.error ?? remove.error, t)}</p>
      )}
    </div>
  )
}

function DeleteClubDialog({ club, onClose, onDeleted }: { club: Club; onClose: () => void; onDeleted: () => void }) {
  const { t } = useTranslation()
  const remove = useDeleteClub()
  return (
    <Modal
      size="sm"
      title={t('clubs.deleteTitle')}
      description={t('clubs.deleteText', { name: club.name })}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(club.id, { onSuccess: onDeleted })}
          >
            <Trash2 className="h-4 w-4" />
            {t('clubs.deleteConfirm')}
          </Button>
        </>
      }
    >
      {remove.error && <ErrorText>{clubErrorMessage(remove.error, t)}</ErrorText>}
    </Modal>
  )
}
