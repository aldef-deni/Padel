import type { TournamentDetail, TournamentMatch } from '@padel/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCourts, useTournamentAction } from '../../lib/queries'
import { teamNameMap, tournamentErrorMessage } from '../../lib/tournaments'
import { Modal } from '../Modal'
import { Button, ErrorText, Field, Input, Select } from '../ui'

/** "2026-10-18T09:00" for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function ScheduleDialog({
  tournament,
  match,
  onClose,
}: {
  tournament: TournamentDetail
  match: TournamentMatch
  onClose: () => void
}) {
  const { t } = useTranslation()
  const courts = useCourts(tournament.clubId)
  const names = teamNameMap(tournament)
  const [courtId, setCourtId] = useState(match.court?.id ?? '')
  const [time, setTime] = useState(toLocalInput(match.scheduledAt))
  const save = useTournamentAction(tournament.id, (req, body: { courtId: string | null; scheduledAt: string | null }) =>
    req(`/matches/${match.id}`, 'PATCH', body),
  )

  return (
    <Modal
      size="sm"
      title={t('tournaments.matches.scheduleTitle')}
      description={`${names.get(match.teamAId ?? '') ?? t('tournaments.matches.tbd')} vs ${names.get(match.teamBId ?? '') ?? t('tournaments.matches.tbd')}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { courtId: courtId || null, scheduledAt: time ? new Date(time).toISOString() : null },
                { onSuccess: onClose },
              )
            }
          >
            {t('tournaments.form.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('tournaments.matches.court')}>
          <Select value={courtId} onChange={(e) => setCourtId(e.target.value)}>
            <option value="">{t('tournaments.matches.noCourt')}</option>
            {courts.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('tournaments.matches.time')}>
          <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        {save.error && <ErrorText>{tournamentErrorMessage(save.error, t)}</ErrorText>}
      </div>
    </Modal>
  )
}
