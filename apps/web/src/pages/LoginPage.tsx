import { ArrowRight, Eye, EyeOff, Loader2, Lock, Radio, RotateCcw, Tv, User } from 'lucide-react'
import { useState, type ComponentType, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { BrandLogo, CourtGraphic } from '../components/brand'
import { Button, ErrorText, Field, Input } from '../components/ui'
import { LANGUAGES, setLanguage } from '../i18n'
import { loginHeroImage } from '../lib/brand-assets'
import { ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { errorMessage } from '../lib/errors'

export function LoginPage() {
  const { t } = useTranslation()
  const { user, login: signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn({ login: login.trim(), password })
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) setError(t('login.invalid'))
      else if (err instanceof ApiRequestError && err.status === 403)
        setError(/club/i.test(err.message) ? t('login.clubDisabled') : t('login.accountDisabled'))
      else setError(errorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <main className="relative flex flex-col px-6 py-8 sm:px-12">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">
            {/* On mobile the brand panel is hidden: show the logo above the form instead. */}
            <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
              <BrandLogo className="h-28" />
              <p className="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase">{t('app.name')}</p>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('login.title')}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('login.subtitle')}</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <Field label={t('login.identifier')}>
                <Input
                  icon={User}
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  required
                  className="h-11"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                />
              </Field>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  {t('login.password')}
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    className="h-11 pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="sr-only">{showPassword ? t('login.hidePassword') : t('login.showPassword')}</span>
                  </button>
                </div>
              </div>

              <ErrorText>{error}</ErrorText>

              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('login.submitting')}
                  </>
                ) : (
                  <>
                    {t('login.submit')}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-8 rounded-xl bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
              {t('login.playerNote')}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 lg:hidden">
          {t('login.copyright', { year: new Date().getFullYear() })}
        </p>
      </main>
    </div>
  )
}

function BrandPanel() {
  const { t } = useTranslation()
  const features: { icon: ComponentType<{ className?: string }>; title: string; text: string }[] = [
    { icon: Radio, title: t('login.feature1'), text: t('login.feature1Text') },
    { icon: RotateCcw, title: t('login.feature2'), text: t('login.feature2Text') },
    { icon: Tv, title: t('login.feature3'), text: t('login.feature3Text') },
  ]

  return (
    <aside className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col xl:p-16">
      {loginHeroImage ? (
        <>
          <img src={loginHeroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-ink-950/95 via-ink-950/80 to-emerald-950/70" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_0%_0%,rgba(16,185,129,0.25),transparent),radial-gradient(60%_50%_at_100%_100%,rgba(20,184,166,0.18),transparent)]" />
          <CourtGraphic
            live
            className="absolute -right-24 bottom-10 w-[125%] max-w-none rotate-[-8deg] opacity-[0.22] [mask-image:linear-gradient(to_top,black_40%,transparent)]"
          />
        </>
      )}

      <div className="relative flex items-center gap-5">
        <BrandLogo className="h-28 drop-shadow-[0_0_24px_rgba(168,85,247,0.35)] xl:h-32" />
        <div className="border-l border-white/15 pl-5">
          <p className="text-xl font-semibold tracking-tight">{t('app.name')}</p>
          <p className="text-sm text-slate-400">{t('app.by')}</p>
        </div>
      </div>

      <div className="relative mt-auto max-w-lg">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-ball" />
          {t('login.heroEyebrow')}
        </p>
        <h2 className="mt-6 text-4xl leading-[1.1] font-semibold tracking-tight xl:text-5xl">{t('login.heroTitle')}</h2>
        <p className="mt-5 text-base leading-relaxed text-slate-300">{t('login.heroText')}</p>

        <ul className="mt-10 grid gap-3">
          {features.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4 backdrop-blur-sm"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-sm text-slate-400">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative mt-12 text-xs text-slate-500">{t('login.copyright', { year: new Date().getFullYear() })}</p>
    </aside>
  )
}

function LanguageToggle() {
  const { t, i18n } = useTranslation()
  return (
    <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          className={`rounded-md px-2.5 py-1 font-semibold ${
            i18n.language === lang ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {t(`lang.${lang}`)}
        </button>
      ))}
    </div>
  )
}
