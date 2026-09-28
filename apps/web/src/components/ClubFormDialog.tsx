import type { Club, CreateClubInput } from '@padel/shared'
import { AtSign, Clock, Globe, Link2, Mail, MapPin, Phone } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { clubErrorMessage, slugify, TIMEZONES } from '../lib/clubs'
import { useCreateClub, useUpdateClub } from '../lib/queries'
import { Modal } from './Modal'
import { Button, ErrorText, Field, Input, Select } from './ui'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const URL_RE = /^https?:\/\/\S+$/i

/** Create (club = null) or edit a club profile. */
export function ClubFormDialog({
  club,
  onClose,
  onSaved,
}: {
  club: Club | null
  onClose: () => void
  onSaved?: (club: Club) => void
}) {
  const { t } = useTranslation()
  const create = useCreateClub()
  const update = useUpdateClub()
  const isEdit = !!club

  const [form, setForm] = useState({
    name: club?.name ?? '',
    slug: club?.slug ?? '',
    description: club?.description ?? '',
    address: club?.address ?? '',
    city: club?.city ?? '',
    mapsUrl: club?.mapsUrl ?? '',
    timezone: club?.timezone ?? 'Asia/Jakarta',
    phone: club?.phone ?? '',
    email: club?.email ?? '',
    website: club?.website ?? '',
    instagram: club?.instagram ?? '',
    openTime: club?.openTime ?? '',
    closeTime: club?.closeTime ?? '',
    isActive: club?.isActive ?? true,
  })
  // New clubs follow the name until the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [submitted, setSubmitted] = useState(false)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const validate = (): string | null => {
    if (!form.name.trim() || !form.slug.trim()) return t('clubs.errors.required')
    if ((form.openTime && !TIME.test(form.openTime)) || (form.closeTime && !TIME.test(form.closeTime))) {
      return t('clubs.errors.time')
    }
    if ((form.website && !URL_RE.test(form.website)) || (form.mapsUrl && !URL_RE.test(form.mapsUrl))) {
      return t('clubs.errors.url')
    }
    return null
  }
  const clientError = submitted ? validate() : null
  const serverError = create.error ?? update.error
  const pending = create.isPending || update.isPending

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (validate()) return
    const orNull = (v: string) => v.trim() || null
    const input: CreateClubInput = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: orNull(form.description),
      address: orNull(form.address),
      city: orNull(form.city),
      mapsUrl: orNull(form.mapsUrl),
      timezone: form.timezone,
      phone: orNull(form.phone),
      email: orNull(form.email),
      website: orNull(form.website),
      instagram: orNull(form.instagram),
      openTime: orNull(form.openTime),
      closeTime: orNull(form.closeTime),
      ...(isEdit ? { isActive: form.isActive } : {}),
    }
    const done = (saved: Club) => {
      onSaved?.(saved)
      onClose()
    }
    if (isEdit) update.mutate({ id: club.id, ...input }, { onSuccess: done })
    else create.mutate(input, { onSuccess: done })
  }

  const timezones = TIMEZONES.some((z) => z.value === form.timezone)
    ? TIMEZONES
    : [...TIMEZONES, { value: form.timezone, label: form.timezone }]

  return (
    <Modal
      title={isEdit ? t('clubs.editTitle') : t('clubs.createTitle')}
      description={isEdit ? club.name : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="club-form" disabled={pending}>
            {pending ? t('clubs.saving') : isEdit ? t('clubs.save') : t('clubs.create')}
          </Button>
        </>
      }
    >
      <form id="club-form" onSubmit={onSubmit} className="space-y-6" noValidate>
        <Section title={t('clubs.sectionIdentity')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('clubs.name')}>
              <Input
                value={form.name}
                maxLength={100}
                onChange={(e) => {
                  set('name', e.target.value)
                  if (!slugTouched) set('slug', slugify(e.target.value))
                }}
              />
            </Field>
            <Field label={t('clubs.slug')} hint={t('clubs.slugHint')}>
              <Input
                value={form.slug}
                maxLength={60}
                className="font-mono"
                onChange={(e) => {
                  setSlugTouched(true)
                  set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                }}
              />
            </Field>
          </div>
          <Field label={t('clubs.descriptionLabel')}>
            <textarea
              value={form.description}
              maxLength={1000}
              rows={3}
              onChange={(e) => set('description', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm shadow-slate-900/5 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
            />
          </Field>
        </Section>

        <Section title={t('clubs.sectionLocation')}>
          <Field label={t('clubs.address')}>
            <Input icon={MapPin} value={form.address} maxLength={255} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('clubs.city')}>
              <Input value={form.city} maxLength={100} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label={t('clubs.timezone')}>
              <Select value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
                {timezones.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t('clubs.mapsUrl')}>
            <Input
              icon={Link2}
              type="url"
              placeholder="https://maps.app.goo.gl/…"
              value={form.mapsUrl}
              maxLength={500}
              onChange={(e) => set('mapsUrl', e.target.value)}
            />
          </Field>
        </Section>

        <Section title={t('clubs.sectionContact')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('clubs.phone')}>
              <Input
                icon={Phone}
                type="tel"
                placeholder="0812…"
                value={form.phone}
                maxLength={32}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
            <Field label={t('clubs.email')}>
              <Input icon={Mail} type="email" value={form.email} maxLength={254} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label={t('clubs.website')}>
              <Input
                icon={Globe}
                type="url"
                placeholder="https://"
                value={form.website}
                maxLength={255}
                onChange={(e) => set('website', e.target.value)}
              />
            </Field>
            <Field label={t('clubs.instagram')} hint={t('clubs.instagramHint')}>
              <Input
                icon={AtSign}
                value={form.instagram}
                maxLength={255}
                onChange={(e) => set('instagram', e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title={t('clubs.sectionOps')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('clubs.openTime')}>
              <Input icon={Clock} type="time" value={form.openTime} onChange={(e) => set('openTime', e.target.value)} />
            </Field>
            <Field label={t('clubs.closeTime')}>
              <Input icon={Clock} type="time" value={form.closeTime} onChange={(e) => set('closeTime', e.target.value)} />
            </Field>
          </div>
          {isEdit && (
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
              <span>
                <span className="block text-sm font-medium text-slate-800">{t('clubs.statusLabel')}</span>
                <span className="block text-xs text-slate-500">{t('clubs.statusHint')}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                className="peer sr-only"
              />
              <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-500/20 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
            </label>
          )}
        </Section>

        {(clientError || serverError) && <ErrorText>{clientError ?? clubErrorMessage(serverError, t)}</ErrorText>}
      </form>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{title}</h3>
      {children}
    </section>
  )
}
