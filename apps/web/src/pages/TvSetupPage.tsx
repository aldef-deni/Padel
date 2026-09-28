import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, ErrorText, Loading, PageHeader } from '../components/ui'
import { errorMessage } from '../lib/errors'
import { useRemoveLogo, useRotateTvLink, useTvLink, useUploadLogo } from '../lib/queries'
import { useClub } from '../lib/use-club'

export function TvSetupPage() {
  const { t } = useTranslation()
  const club = useClub()

  return (
    <>
      <PageHeader title={t('tvSetup.title')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <LogoCard clubId={club.id} clubName={club.name} logoUrl={club.logoUrl} />
        <TvLinkCard clubId={club.id} />
      </div>
    </>
  )
}

function LogoCard({ clubId, clubName, logoUrl }: { clubId: string; clubName: string; logoUrl: string | null }) {
  const { t } = useTranslation()
  const upload = useUploadLogo(clubId)
  const remove = useRemoveLogo(clubId)
  const input = useRef<HTMLInputElement>(null)
  const error = upload.error ?? remove.error

  return (
    <Card className="p-4">
      <h2 className="font-semibold">{t('tvSetup.logo')}</h2>
      <p className="mb-4 text-sm text-slate-500">{t('tvSetup.logoHint')}</p>
      <div className="mb-4 flex h-40 items-center justify-center rounded-lg bg-slate-900 p-4">
        {logoUrl ? (
          <img src={logoUrl} alt={clubName} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-sm text-slate-400">{t('tvSetup.noLogo')}</span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label={t('tvSetup.upload')}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate(file)
          e.target.value = ''
        }}
      />
      <div className="flex gap-2">
        <Button onClick={() => input.current?.click()} disabled={upload.isPending}>
          {t('tvSetup.upload')}
        </Button>
        {logoUrl && (
          <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {t('tvSetup.removeLogo')}
          </Button>
        )}
      </div>
      {error && (
        <div className="mt-3">
          <ErrorText>{errorMessage(error, t)}</ErrorText>
        </div>
      )}
    </Card>
  )
}

function TvLinkCard({ clubId }: { clubId: string }) {
  const { t } = useTranslation()
  const link = useTvLink(clubId)
  const rotate = useRotateTvLink(clubId)
  const [copied, setCopied] = useState(false)
  const url = link.data?.url

  const onRotate = () => {
    if (!url || window.confirm(t('tvSetup.confirmRotate'))) rotate.mutate()
  }
  const onCopy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="p-4">
      <h2 className="font-semibold">{t('tvSetup.link')}</h2>
      <p className="mb-4 text-sm text-slate-500">{t('tvSetup.linkHint')}</p>
      {link.isPending ? (
        <Loading label={t('common.loading')} />
      ) : url ? (
        <>
          <p className="break-all rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-700" data-testid="tv-url">
            {url}
          </p>
          <p className="mt-2 text-xs text-amber-700">{t('tvSetup.secret')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {t('tvSetup.open')}
            </a>
            <Button variant="secondary" onClick={onCopy}>
              {copied ? t('tvSetup.copied') : t('tvSetup.copy')}
            </Button>
            <Button variant="ghost" onClick={onRotate} disabled={rotate.isPending}>
              {t('tvSetup.rotate')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600">{t('tvSetup.noLink')}</p>
          <Button onClick={onRotate} disabled={rotate.isPending}>
            {t('tvSetup.create')}
          </Button>
        </>
      )}
      {(link.error ?? rotate.error) && (
        <div className="mt-3">
          <ErrorText>{errorMessage(link.error ?? rotate.error, t)}</ErrorText>
        </div>
      )}
    </Card>
  )
}
