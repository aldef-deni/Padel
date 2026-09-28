import type { ClubPlayer, CreateClubPlayerResponse } from '@padel/shared'
import { Mail, Phone, StickyNote, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { playerErrorMessage } from '../lib/players'
import { useCreatePlayer, useUpdatePlayer } from '../lib/queries'
import { Modal } from './Modal'
import { Button, ErrorText, Field, Input } from './ui'

/** Add (player = null) or edit a club player. */
export function PlayerFormDialog({
  clubId,
  player,
  onClose,
  onCreated,
}: {
  clubId: string
  player: ClubPlayer | null
  onClose: () => void
  onCreated?: (result: CreateClubPlayerResponse) => void
}) {
  const { t } = useTranslation()
  const create = useCreatePlayer(clubId)
  const update = useUpdatePlayer(clubId)
  const isEdit = !!player
  const [phone, setPhone] = useState(player?.phone ?? '')
  const [name, setName] = useState(player?.name ?? '')
  const [email, setEmail] = useState(player?.email ?? '')
  const [note, setNote] = useState(player?.note ?? '')
  const [isBlocked, setIsBlocked] = useState(player?.isBlocked ?? false)
  const [submitted, setSubmitted] = useState(false)

  const clientError = submitted && !phone.trim() ? t('players.errors.phoneRequired') : null
  const serverError = create.error ?? update.error
  const pending = create.isPending || update.isPending

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!phone.trim()) return
    const orNull = (v: string) => v.trim() || null
    if (isEdit) {
      update.mutate(
        { id: player.id, phone: phone.trim(), name: orNull(name), email: orNull(email), note: orNull(note), isBlocked },
        { onSuccess: onClose },
      )
    } else {
      create.mutate(
        { phone: phone.trim(), name: orNull(name), email: orNull(email), note: orNull(note) },
        {
          onSuccess: (result) => {
            onCreated?.(result)
            onClose()
          },
        },
      )
    }
  }

  return (
    <Modal
      title={isEdit ? t('players.editTitle') : t('players.createTitle')}
      description={isEdit ? (player.name ?? player.phone) : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="player-form" disabled={pending}>
            {pending ? t('players.saving') : isEdit ? t('players.save') : t('players.create')}
          </Button>
        </>
      }
    >
      <form id="player-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label={t('players.phone')} hint={t('players.phoneHint')}>
          <Input
            icon={Phone}
            type="tel"
            inputMode="tel"
            placeholder="0812…"
            autoFocus={!isEdit}
            value={phone}
            maxLength={32}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('players.name')}>
            <Input icon={UserRound} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('players.email')}>
            <Input icon={Mail} type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        <Field label={t('players.note')} hint={t('players.noteHint')}>
          <div className="relative">
            <StickyNote className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
            <textarea
              value={note}
              maxLength={500}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm shadow-sm shadow-slate-900/5 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>
        </Field>
        {isEdit && (
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
            <span>
              <span className="block text-sm font-medium text-slate-800">{t('players.blockLabel')}</span>
              <span className="block text-xs text-slate-500">{t('players.blockHint')}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={isBlocked}
              onChange={(e) => setIsBlocked(e.target.checked)}
              className="peer sr-only"
            />
            <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-red-500 peer-focus-visible:ring-4 peer-focus-visible:ring-red-500/20 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
          </label>
        )}
        {(clientError || serverError) && <ErrorText>{clientError ?? playerErrorMessage(serverError, t)}</ErrorText>}
      </form>
    </Modal>
  )
}
