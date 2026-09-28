import type { CreateUserInput, ManagedUser, Role } from '@padel/shared'
import { Check, Copy, Crown, Eye, EyeOff, KeyRound, ShieldCheck, User as UserIcon, Wand2 } from 'lucide-react'
import { useState, type ComponentType, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth-context'
import { useClubs, useCreateUser, useUpdateUser } from '../lib/queries'
import { generatePassword, USERNAME_RE, userErrorMessage } from '../lib/users'
import { Modal } from './Modal'
import { Button, ErrorText, Field, Input, Select } from './ui'

const ROLE_OPTIONS: { role: Role; icon: ComponentType<{ className?: string }> }[] = [
  { role: 'SUPER_ADMIN', icon: Crown },
  { role: 'CLUB_ADMIN', icon: ShieldCheck },
  { role: 'PLAYER', icon: UserIcon },
]

/** Create (user = null) or edit a user; fields follow the chosen role's rules. */
export function UserFormDialog({
  user,
  onClose,
  preset,
}: {
  user: ManagedUser | null
  onClose: () => void
  /** Defaults for a new user, e.g. a club admin for the club being viewed. */
  preset?: { role: Role; clubId?: string }
}) {
  const { t } = useTranslation()
  const { user: me } = useAuth()
  const clubs = useClubs()
  const create = useCreateUser()
  const update = useUpdateUser()
  const isEdit = !!user
  const isSelf = user?.id === me?.id

  const [role, setRole] = useState<Role>(user?.role ?? preset?.role ?? 'CLUB_ADMIN')
  const [name, setName] = useState(user?.name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [clubId, setClubId] = useState(user?.clubId ?? preset?.clubId ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isActive, setIsActive] = useState(user?.isActive ?? true)
  // Validation shows after the first submit attempt, then follows every edit.
  const [submitted, setSubmitted] = useState(false)

  const isAdmin = role !== 'PLAYER'
  // A player promoted to admin (or an admin without a password) needs one.
  const passwordRequired = isAdmin && (!isEdit || !user.hasPassword)
  const pending = create.isPending || update.isPending
  const serverError = create.error ?? update.error

  const validate = (): string | null => {
    if (isAdmin) {
      if (!username.trim() && !email.trim()) return t('users.errors.loginRequired')
      if (username.trim() && !USERNAME_RE.test(username.trim())) return t('users.errors.usernameInvalid')
      if (role === 'CLUB_ADMIN' && !clubId) return t('users.errors.clubRequired')
      if (passwordRequired && !password) return t('users.errors.passwordRequired')
    } else if (!phone.trim() && !email.trim()) {
      return t('users.errors.contactRequired')
    }
    if (password && password.length < 12) return t('users.errors.passwordShort')
    return null
  }

  const clientError = submitted ? validate() : null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (validate()) return

    const orNull = (v: string) => v.trim() || null
    const input: CreateUserInput = {
      role,
      name: orNull(name),
      // Players keep optional identifiers; admins' identifiers are validated above.
      username: orNull(username),
      email: orNull(email),
      phone: orNull(phone),
      clubId: role === 'CLUB_ADMIN' ? clubId : null,
      ...(isAdmin && password ? { password } : {}),
      ...(isEdit ? { isActive } : {}),
    }
    if (isEdit) update.mutate({ id: user.id, ...input }, { onSuccess: onClose })
    else create.mutate(input, { onSuccess: onClose })
  }

  const onGenerate = () => {
    setPassword(generatePassword())
    setShowPassword(true)
  }
  const onCopy = async () => {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Modal
      title={isEdit ? t('users.editTitle') : t('users.createTitle')}
      description={isEdit ? (user.name ?? user.username ?? user.email ?? user.phone) : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="user-form" disabled={pending}>
            {pending ? t('users.saving') : isEdit ? t('users.save') : t('users.create')}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        <fieldset disabled={isSelf}>
          <legend className="mb-2 text-sm font-medium text-slate-700">{t('users.role')}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {ROLE_OPTIONS.map(({ role: option, icon: Icon }) => {
              const selected = role === option
              return (
                <label
                  key={option}
                  className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition ${
                    selected
                      ? 'border-emerald-500 bg-emerald-50/60 ring-4 ring-emerald-500/10'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${isSelf ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option}
                    checked={selected}
                    onChange={() => setRole(option)}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Icon className={`h-4 w-4 ${selected ? 'text-emerald-600' : 'text-slate-400'}`} />
                    {t(`roles.${option}`)}
                  </span>
                  <span className="text-xs leading-snug text-slate-500">{t(`users.roleHint.${option}`)}</span>
                </label>
              )
            })}
          </div>
          {isSelf && <p className="mt-2 text-xs text-amber-700">{t('users.selfHint')}</p>}
        </fieldset>

        <Field label={t('users.name')}>
          <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </Field>

        {role === 'CLUB_ADMIN' && (
          <Field label={t('users.club')}>
            <Select value={clubId} onChange={(e) => setClubId(e.target.value)}>
              <option value="">{t('users.chooseClub')}</option>
              {clubs.data?.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {isAdmin && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-xs text-slate-500">{t('users.loginHint')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('users.username')} hint={t('users.usernameHint')}>
                <Input
                  value={username}
                  maxLength={32}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                />
              </Field>
              <Field label={t('users.email')}>
                <Input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {role === 'PLAYER' && (
          <Field label={t('users.email')} hint={t('users.emailHintPlayer')}>
            <Input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        )}

        <Field label={t('users.phone')} hint={t('users.phoneHintAdmin')}>
          <Input
            type="tel"
            inputMode="tel"
            placeholder="0812…"
            value={phone}
            maxLength={32}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>

        {isAdmin && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="user-password" className="text-sm font-medium text-slate-700">
                {isEdit && user.hasPassword ? t('users.passwordNew') : t('users.password')}
              </label>
              <button
                type="button"
                onClick={onGenerate}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                <Wand2 className="h-3.5 w-3.5" />
                {t('users.generate')}
              </button>
            </div>
            <div className="relative">
              <Input
                id="user-password"
                icon={KeyRound}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                maxLength={200}
                className="pr-20 font-mono"
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 gap-0.5">
                {password && (
                  <button
                    type="button"
                    onClick={onCopy}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title={copied ? t('users.copied') : t('users.copy')}
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {isEdit && user.hasPassword ? t('users.passwordHintEdit') : t('users.passwordHintCreate')}
            </p>
          </div>
        )}

        {isEdit && (
          <label
            className={`flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 ${isSelf ? 'opacity-60' : 'cursor-pointer'}`}
          >
            <span>
              <span className="block text-sm font-medium text-slate-800">{t('users.statusLabel')}</span>
              <span className="block text-xs text-slate-500">{t('users.statusHint')}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={isActive}
              disabled={isSelf}
              onChange={(e) => setIsActive(e.target.checked)}
              className="peer sr-only"
            />
            <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-500/20 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
          </label>
        )}

        {(clientError || serverError) && (
          <ErrorText>{clientError ?? userErrorMessage(serverError, t)}</ErrorText>
        )}
      </form>
    </Modal>
  )
}
