import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Button, Card, ErrorText, Field, Input } from '../components/ui'
import { ApiRequestError } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import { errorMessage } from '../lib/errors'

export function LoginPage() {
  const { t } = useTranslation()
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiRequestError && err.status === 401 ? t('login.invalid') : errorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <img src="/favicon.svg" alt="" className="mx-auto mb-3 h-10 w-10" />
          <h1 className="text-xl font-semibold">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('login.subtitle')}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label={t('login.email')}>
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={t('login.password')}>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
