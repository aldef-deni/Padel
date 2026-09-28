import type { TournamentDetail, TournamentTeam, TournamentTeamInput, TournamentTeamStatus } from '@padel/shared'
import { Link2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useClubPlayers, useTournamentAction } from '../../lib/queries'
import { tournamentErrorMessage } from '../../lib/tournaments'
import { Modal } from '../Modal'
import { Button, ErrorText, Field, Input, Select } from '../ui'
import { Toggle } from './TournamentFormDialog'

const STATUSES: TournamentTeamStatus[] = ['REGISTERED', 'CONFIRMED', 'WITHDRAWN']

/** Add or edit a team (pair). Players can be linked to club player accounts. */
export function TeamFormDialog({
  tournament,
  team,
  onClose,
}: {
  tournament: TournamentDetail
  team: TournamentTeam | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const rosterOpen = tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION'
  const save = useTournamentAction(tournament.id, (req, input: TournamentTeamInput) =>
    team ? req(`/teams/${team.id}`, 'PATCH', input) : req('/teams', 'POST', input),
  )
  const [f, setF] = useState({
    name: team?.name ?? '',
    player1Name: team?.player1Name ?? '',
    player2Name: team?.player2Name ?? '',
    player1Id: team?.player1Id ?? null,
    player2Id: team?.player2Id ?? null,
    seed: team?.seed?.toString() ?? '',
    status: team?.status ?? ('REGISTERED' as TournamentTeamStatus),
    paid: team?.paid ?? false,
    note: team?.note ?? '',
  })
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((x) => ({ ...x, [key]: value }))
  const [submitted, setSubmitted] = useState(false)
  const missing = !f.player1Name.trim() || !f.player2Name.trim()

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (missing) return
    const autoName = `${f.player1Name.trim()} / ${f.player2Name.trim()}`
    save.mutate(
      {
        // Keep the automatic name in sync when it was not customised.
        name: f.name.trim() && f.name.trim() !== `${team?.player1Name} / ${team?.player2Name}` ? f.name.trim() : autoName,
        player1Name: f.player1Name.trim(),
        player2Name: f.player2Name.trim(),
        player1Id: f.player1Id,
        player2Id: f.player2Id,
        note: f.note.trim() || null,
        paid: f.paid,
        ...(rosterOpen ? { seed: f.seed ? Number(f.seed) : null, status: f.status } : {}),
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal
      title={team ? t('tournaments.teams.editTitle') : t('tournaments.teams.createTitle')}
      description={team?.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="team-form" disabled={save.isPending}>
            {save.isPending ? t('tournaments.form.saving') : t('tournaments.form.save')}
          </Button>
        </>
      }
    >
      <form id="team-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        {!rosterOpen && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t('tournaments.teams.locked')}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <PlayerField
            label={t('tournaments.teams.player1')}
            clubId={tournament.clubId}
            name={f.player1Name}
            linkedId={f.player1Id}
            onName={(v) => set('player1Name', v)}
            onLink={(id, name) => setF((x) => ({ ...x, player1Id: id, player1Name: name ?? x.player1Name }))}
          />
          <PlayerField
            label={t('tournaments.teams.player2')}
            clubId={tournament.clubId}
            name={f.player2Name}
            linkedId={f.player2Id}
            onName={(v) => set('player2Name', v)}
            onLink={(id, name) => setF((x) => ({ ...x, player2Id: id, player2Name: name ?? x.player2Name }))}
          />
        </div>
        <Field label={t('tournaments.teams.name')} hint={t('tournaments.teams.nameHint')}>
          <Input
            value={f.name}
            maxLength={80}
            placeholder={f.player1Name && f.player2Name ? `${f.player1Name} / ${f.player2Name}` : ''}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('tournaments.teams.seed')} hint={t('tournaments.teams.seedHint')}>
            <Input type="number" min={1} max={128} value={f.seed} disabled={!rosterOpen} onChange={(e) => set('seed', e.target.value)} />
          </Field>
          <Field label={t('tournaments.teams.status')}>
            <Select value={f.status} disabled={!rosterOpen} onChange={(e) => set('status', e.target.value as TournamentTeamStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`tournaments.teams.statusLabel.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Toggle label={t('tournaments.teams.paid')} checked={f.paid} onChange={(v) => set('paid', v)} />
        <Field label={t('tournaments.teams.note')}>
          <Input value={f.note} maxLength={500} onChange={(e) => set('note', e.target.value)} />
        </Field>
        {((submitted && missing) || save.error) && (
          <ErrorText>{submitted && missing ? t('tournaments.errors.playersRequired') : tournamentErrorMessage(save.error, t)}</ErrorText>
        )}
      </form>
    </Modal>
  )
}

/** Player name with an optional link to a club player account (searchable). */
function PlayerField({
  label,
  clubId,
  name,
  linkedId,
  onName,
  onLink,
}: {
  label: string
  clubId: string
  name: string
  linkedId: string | null
  onName: (value: string) => void
  onLink: (id: string | null, name?: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const players = useClubPlayers(clubId, { search: search || undefined, pageSize: 8 })

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <Input value={name} maxLength={80} onChange={(e) => onName(e.target.value)} aria-label={label} />
      {linkedId ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <Link2 className="h-3 w-3" />
          {t('tournaments.teams.linked')}
          <button type="button" onClick={() => onLink(null)} aria-label="unlink" className="hover:text-emerald-900">
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : open ? (
        <div className="rounded-xl border border-slate-200 p-2">
          <Input autoFocus placeholder={t('tournaments.teams.searchPlayer')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <ul className="mt-1 max-h-40 overflow-y-auto">
            {players.data?.items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onLink(p.id, p.name ?? undefined)
                    setOpen(false)
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  {p.name ?? p.email ?? p.phone}
                  <span className="ml-1 text-xs text-slate-400">{p.email ?? p.phone}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-emerald-700 hover:underline">
          {t('tournaments.teams.linkPlayer')}
        </button>
      )}
    </div>
  )
}
