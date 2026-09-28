import type { AuthResponse, UpdateProfileInput, User } from '@padel/shared'
import { AtSign, Camera, Check, KeyRound, Lock, Mail, Phone, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AvatarDialog } from '../components/AvatarDialog'
import { Button, Card, ErrorText, Field, Input, PageHeader } from '../components/ui'
import { UserAvatar } from '../components/UserAvatar'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { useActiveClub } from '../lib/club-context'
import { relativeTime } from '../lib/format'
import { userErrorMessage, USERNAME_RE } from '../lib/users'

export function ProfilePage() {
  const { t, i18n } = useTranslation()
  const { user, updateUser } = useAuth()
  const { clubs } = useActiveClub()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  if (!user) return null

  const name = user.name ?? user.username ?? user.email ?? ''
  const club = clubs.find((c) => c.id === user.clubId)
  const removeAvatar = async () => {
    setRemoving(true)
    try {
      updateUser(await api<User>('/auth/me/avatar', { method: 'DELETE' }))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <PageHeader title={t('profile.title')} description={t('profile.description')} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-ink-900 via-ink-800 to-emerald-900" />
          <div className="-mt-14 flex flex-col items-center px-6 pb-6 text-center">
            <div className="relative">
              <UserAvatar name={name} url={user.avatarUrl} className="h-28 w-28 text-3xl ring-4 ring-white" tone="slate" />
              <button
                type="button"
                onClick={() => setAvatarOpen(true)}
                className="absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-4 ring-white hover:bg-emerald-500"
                aria-label={t('profile.avatar.change')}
                title={t('profile.avatar.change')}
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">{name}</h2>
            <p className="text-sm text-slate-500">{[user.username && `@${user.username}`, user.email].filter(Boolean).join(' · ')}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-600/20 ring-inset">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t(`roles.${user.role}`)}
            </span>
            <dl className="mt-6 w-full space-y-2 border-t border-slate-100 pt-4 text-left text-sm">
              {club && <InfoRow label={t('common.club')} value={club.name} />}
              <InfoRow
                label={t('profile.memberSince')}
                value={new Date(user.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'long' })}
              />
              <InfoRow
                label={t('profile.lastLogin')}
                value={user.lastLoginAt ? relativeTime(user.lastLoginAt, i18n.language) : t('users.never')}
              />
            </dl>
            <div className="mt-5 flex w-full gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setAvatarOpen(true)}>
                <Camera className="h-3.5 w-3.5" />
                {user.avatarUrl ? t('profile.avatar.change') : t('profile.avatar.upload')}
              </Button>
              {user.avatarUrl && (
                <Button variant="ghost" size="sm" onClick={removeAvatar} disabled={removing} aria-label={t('profile.avatar.remove')} title={t('profile.avatar.remove')}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <AccountForm user={user} />
          <PasswordForm />
        </div>
      </div>
      {avatarOpen && <AvatarDialog onClose={() => setAvatarOpen(false)} />}
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate font-medium text-slate-800">{value}</dd>
    </div>
  )
}

function SavedBadge({ show }: { show: boolean }) {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700" role="status">
      <Check className="h-4 w-4" />
      {t('profile.saved')}
    </span>
  )
}

function AccountForm({ user }: { user: User }) {
  const { t } = useTranslation()
  const { updateUser } = useAuth()
  const [form, setForm] = useState({
    name: user.name ?? '',
    username: user.username ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.username.trim() && !form.email.trim()) return setError(t('users.errors.loginRequired'))
    if (form.username.trim() && !USERNAME_RE.test(form.username.trim())) return setError(t('users.errors.usernameInvalid'))
    setError(null)
    setSaving(true)
    const orNull = (v: string) => v.trim() || null
    const input: UpdateProfileInput = {
      name: orNull(form.name),
      username: orNull(form.username),
      email: orNull(form.email),
      phone: orNull(form.phone),
    }
    try {
      updateUser(await api<User>('/auth/me', { method: 'PATCH', body: input }))
      setSaved(true)
    } catch (err) {
      setError(userErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold tracking-tight text-slate-900">{t('profile.account')}</h2>
          <p className="text-sm text-slate-500">{t('profile.accountHint')}</p>
        </div>
        <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t('users.name')}>
              <Input icon={UserRound} value={form.name} maxLength={100} onChange={(e) => set('name', e.target.value)} />
            </Field>
          </div>
          <Field label={t('users.username')} hint={t('users.usernameHint')}>
            <Input
              icon={AtSign}
              value={form.username}
              maxLength={32}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => set('username', e.target.value.toLowerCase())}
            />
          </Field>
          <Field label={t('users.email')}>
            <Input icon={Mail} type="email" value={form.email} maxLength={254} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label={t('users.phone')} hint={t('users.phoneHintAdmin')}>
            <Input icon={Phone} type="tel" placeholder="0812…" value={form.phone} maxLength={32} onChange={(e) => set('phone', e.target.value)} />
          </Field>
        </div>
        {error && (
          <div className="px-6 pb-4">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
          <SavedBadge show={saved} />
          <Button type="submit" disabled={saving}>
            {saving ? t('profile.saving') : t('profile.save')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function PasswordForm() {
  const { t } = useTranslation()
  const { setSession } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaved(false)
    if (next.length < 12) return setError(t('users.errors.passwordShort'))
    if (next !== confirm) return setError(t('profile.password.mismatch'))
    if (next === current) return setError(t('profile.password.same'))
    setError(null)
    setSaving(true)
    try {
      // The server revokes older tokens and returns a new one for this browser.
      setSession(
        await api<AuthResponse>('/auth/password', {
          method: 'PATCH',
          body: { currentPassword: current, newPassword: next },
        }),
      )
      setCurrent('')
      setNext('')
      setConfirm('')
      setSaved(true)
    } catch (err) {
      setError(
        err instanceof Error && /Current password is incorrect/.test(err.message)
          ? t('profile.password.wrongCurrent')
          : userErrorMessage(err, t),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold tracking-tight text-slate-900">{t('profile.password.title')}</h2>
          <p className="text-sm text-slate-500">{t('profile.password.hint')}</p>
        </div>
        <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t('profile.password.current')}>
              <Input icon={Lock} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
          </div>
          <Field label={t('profile.password.new')} hint={t('users.passwordHintCreate')}>
            <Input icon={KeyRound} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label={t('profile.password.confirm')}>
            <Input icon={KeyRound} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </div>
        {error && (
          <div className="px-6 pb-4">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
          <SavedBadge show={saved} />
          <Button type="submit" disabled={saving || !current || !next}>
            {saving ? t('profile.saving') : t('profile.password.submit')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
