import type { CreateTournamentInput, TournamentDetail, TournamentFormat, UpdateTournamentInput } from '@padel/shared'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateTournament, useTournamentAction } from '../../lib/queries'
import { tournamentErrorMessage } from '../../lib/tournaments'
import { Modal } from '../Modal'
import { Button, ErrorText, Field, Input, Select } from '../ui'

const FORMATS: TournamentFormat[] = ['SINGLE_ELIMINATION', 'ROUND_ROBIN', 'GROUPS_KNOCKOUT']

function dateOnly(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : ''
}

/** Create (tournament = null) or edit tournament settings. */
export function TournamentFormDialog({
  clubId,
  tournament,
  onClose,
  onSaved,
}: {
  clubId: string
  tournament: TournamentDetail | null
  onClose: () => void
  onSaved?: (t: TournamentDetail) => void
}) {
  const { t } = useTranslation()
  const create = useCreateTournament()
  const update = useTournamentAction(tournament?.id ?? '', (req, input: UpdateTournamentInput) => req('', 'PATCH', input))
  const isEdit = !!tournament
  const locked = isEdit && tournament.matches.length > 0

  const [f, setF] = useState({
    name: tournament?.name ?? '',
    category: tournament?.category ?? '',
    description: tournament?.description ?? '',
    startDate: dateOnly(tournament?.startDate) || new Date().toISOString().slice(0, 10),
    endDate: dateOnly(tournament?.endDate),
    registrationDeadline: dateOnly(tournament?.registrationDeadline),
    format: tournament?.format ?? ('SINGLE_ELIMINATION' as TournamentFormat),
    maxTeams: tournament?.maxTeams?.toString() ?? '',
    entryFee: tournament?.entryFee?.toString() ?? '',
    prizeInfo: tournament?.prizeInfo ?? '',
    isPublic: tournament?.isPublic ?? true,
    setsToWin: tournament?.setsToWin ?? 2,
    gamesPerSet: tournament?.gamesPerSet ?? 6,
    superTiebreak: tournament?.superTiebreak ?? true,
    goldenPoint: tournament?.goldenPoint ?? true,
    groupCount: tournament?.groupCount ?? 2,
    advancePerGroup: tournament?.advancePerGroup ?? 2,
    thirdPlaceMatch: tournament?.thirdPlaceMatch ?? false,
  })
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((x) => ({ ...x, [key]: value }))
  const [submitted, setSubmitted] = useState(false)
  const clientError = submitted && !f.name.trim() ? t('tournaments.errors.nameRequired') : null
  const error = create.error ?? update.error
  const pending = create.isPending || update.isPending

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!f.name.trim()) return
    const orNull = (v: string) => v.trim() || null
    const num = (v: string) => (v.trim() ? Number(v) : null)
    const settings: UpdateTournamentInput = {
      name: f.name.trim(),
      category: orNull(f.category),
      description: orNull(f.description),
      startDate: f.startDate,
      endDate: orNull(f.endDate),
      registrationDeadline: orNull(f.registrationDeadline),
      maxTeams: num(f.maxTeams),
      entryFee: num(f.entryFee),
      prizeInfo: orNull(f.prizeInfo),
      isPublic: f.isPublic,
      goldenPoint: f.goldenPoint,
      // Structural settings only while there is no draw.
      ...(locked
        ? {}
        : {
            format: f.format,
            setsToWin: f.setsToWin,
            gamesPerSet: f.gamesPerSet,
            superTiebreak: f.superTiebreak,
            groupCount: f.groupCount,
            advancePerGroup: f.advancePerGroup,
            thirdPlaceMatch: f.thirdPlaceMatch,
          }),
    }
    const done = (saved: TournamentDetail | void) => {
      if (saved) onSaved?.(saved)
      onClose()
    }
    if (isEdit) update.mutate(settings, { onSuccess: done })
    else create.mutate({ ...(settings as CreateTournamentInput), clubId, format: f.format }, { onSuccess: done })
  }

  const hasKnockout = f.format !== 'ROUND_ROBIN'

  return (
    <Modal
      title={isEdit ? t('tournaments.form.editTitle') : t('tournaments.form.createTitle')}
      description={isEdit ? tournament.name : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="tournament-form" disabled={pending}>
            {pending ? t('tournaments.form.saving') : isEdit ? t('tournaments.form.save') : t('tournaments.form.create')}
          </Button>
        </>
      }
    >
      <form id="tournament-form" onSubmit={onSubmit} className="space-y-6" noValidate>
        <Section title={t('tournaments.form.general')}>
          <Field label={t('tournaments.form.name')}>
            <Input value={f.name} maxLength={120} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label={t('tournaments.form.category')} hint={t('tournaments.form.categoryHint')}>
            <Input value={f.category} maxLength={60} onChange={(e) => set('category', e.target.value)} />
          </Field>
          <Field label={t('tournaments.form.description')}>
            <textarea
              rows={3}
              maxLength={2000}
              value={f.description}
              onChange={(e) => set('description', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm shadow-slate-900/5 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
            />
          </Field>
        </Section>

        <Section title={t('tournaments.form.scheduleSection')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('tournaments.form.startDate')}>
              <Input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label={t('tournaments.form.endDate')}>
              <Input type="date" value={f.endDate} min={f.startDate} onChange={(e) => set('endDate', e.target.value)} />
            </Field>
            <Field label={t('tournaments.form.registrationDeadline')}>
              <Input type="date" value={f.registrationDeadline} onChange={(e) => set('registrationDeadline', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('tournaments.form.maxTeams')}>
              <Input type="number" min={2} max={128} value={f.maxTeams} onChange={(e) => set('maxTeams', e.target.value)} />
            </Field>
            <Field label={t('tournaments.form.entryFee')}>
              <Input type="number" min={0} step={1000} value={f.entryFee} onChange={(e) => set('entryFee', e.target.value)} />
            </Field>
            <Field label={t('tournaments.form.prizeInfo')}>
              <Input value={f.prizeInfo} maxLength={500} onChange={(e) => set('prizeInfo', e.target.value)} />
            </Field>
          </div>
          <Toggle
            label={t('tournaments.form.isPublic')}
            hint={t('tournaments.form.isPublicHint')}
            checked={f.isPublic}
            onChange={(v) => set('isPublic', v)}
          />
        </Section>

        <Section title={t('tournaments.form.formatSection')}>
          {locked && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t('tournaments.form.locked')}</p>}
          <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
            <div className="grid gap-2 sm:grid-cols-3">
              {FORMATS.map((format) => (
                <label
                  key={format}
                  className={`cursor-pointer rounded-xl border p-3 transition ${
                    f.format === format ? 'border-emerald-500 bg-emerald-50/60 ring-4 ring-emerald-500/10' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={format}
                    checked={f.format === format}
                    onChange={() => set('format', format)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-semibold text-slate-900">{t(`tournaments.format.${format}`)}</span>
                  <span className="mt-1 block text-xs leading-snug text-slate-500">{t(`tournaments.formatHint.${format}`)}</span>
                </label>
              ))}
            </div>
            {f.format === 'GROUPS_KNOCKOUT' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('tournaments.form.groupCount')}>
                  <Input type="number" min={1} max={16} value={f.groupCount} onChange={(e) => set('groupCount', Number(e.target.value))} />
                </Field>
                <Field label={t('tournaments.form.advancePerGroup')}>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={f.advancePerGroup}
                    onChange={(e) => set('advancePerGroup', Number(e.target.value))}
                  />
                </Field>
              </div>
            )}
            {hasKnockout && (
              <Toggle label={t('tournaments.form.thirdPlaceMatch')} checked={f.thirdPlaceMatch} onChange={(v) => set('thirdPlaceMatch', v)} />
            )}
          </fieldset>
        </Section>

        <Section title={t('tournaments.form.scoringSection')}>
          <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('tournaments.form.setsToWin')}>
                <Select value={f.setsToWin} onChange={(e) => set('setsToWin', Number(e.target.value))}>
                  <option value={2}>{t('tournaments.form.bestOf3')}</option>
                  <option value={1}>{t('tournaments.form.oneSet')}</option>
                </Select>
              </Field>
              <Field label={t('tournaments.form.gamesPerSet')}>
                <Select value={f.gamesPerSet} onChange={(e) => set('gamesPerSet', Number(e.target.value))}>
                  {[4, 6, 9].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {f.setsToWin === 2 && (
              <Toggle label={t('tournaments.form.superTiebreak')} checked={f.superTiebreak} onChange={(v) => set('superTiebreak', v)} />
            )}
          </fieldset>
          <Toggle label={t('tournaments.form.goldenPoint')} checked={f.goldenPoint} onChange={(v) => set('goldenPoint', v)} />
        </Section>

        {(clientError || error) && <ErrorText>{clientError ?? tournamentErrorMessage(error, t)}</ErrorText>}
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

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={`flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-3.5 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  )
}
