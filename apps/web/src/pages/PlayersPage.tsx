import type { ClubPlayer, ClubPlayerListQuery } from '@padel/shared'
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Pencil,
  Plus,
  Search,
  ShieldBan,
  ShieldCheck,
  StickyNote,
  UserMinus,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../components/Modal'
import { PlayerFormDialog } from '../components/PlayerFormDialog'
import { UserAvatar } from '../components/UserAvatar'
import { Button, Card, ErrorText, Input, Loading, PageHeader } from '../components/ui'
import { relativeTime } from '../lib/format'
import { playerErrorMessage } from '../lib/players'
import { useClubPlayers, useRemovePlayer, useUpdatePlayer } from '../lib/queries'
import { useClub } from '../lib/use-club'

const PAGE_SIZE = 20
type Status = 'ALL' | 'ACTIVE' | 'BLOCKED'

export function PlayersPage() {
  const { t } = useTranslation()
  const club = useClub()
  const [status, setStatus] = useState<Status>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ClubPlayer | 'new' | null>(null)
  const [removing, setRemoving] = useState<ClubPlayer | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const update = useUpdatePlayer(club.id)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const query: ClubPlayerListQuery = {
    search: search || undefined,
    status: status === 'ALL' ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  }
  const players = useClubPlayers(club.id, query)
  const data = players.data
  const tabs: { key: Status; label: string }[] = [
    { key: 'ALL', label: t('players.all') },
    { key: 'ACTIVE', label: t('players.active') },
    { key: 'BLOCKED', label: t('players.blocked') },
  ]

  const toggleBlock = (player: ClubPlayer) => {
    const name = player.name ?? player.phone ?? ''
    if (!player.isBlocked && !window.confirm(t('players.blockConfirm', { name }))) return
    update.mutate({ id: player.id, isBlocked: !player.isBlocked })
  }

  return (
    <>
      <PageHeader
        title={t('players.title')}
        description={t('players.description', { club: club.name })}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            {t('players.add')}
          </Button>
        }
      />

      {notice && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-sky-600 hover:text-sky-900" aria-label={t('dashboard.close')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatus(tab.key)
                setPage(1)
              }}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                status === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              <span
                className={`rounded-md px-1.5 text-xs tabular-nums ${status === tab.key ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-500'}`}
              >
                {data?.counts[tab.key] ?? '·'}
              </span>
            </button>
          ))}
        </div>
        <div className="w-full lg:w-80">
          <Input icon={Search} type="search" placeholder={t('players.search')} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
      </div>

      {update.error && (
        <div className="mb-4">
          <ErrorText>{playerErrorMessage(update.error, t)}</ErrorText>
        </div>
      )}

      {players.isPending ? (
        <Loading label={t('common.loading')} />
      ) : players.error ? (
        <ErrorText>{playerErrorMessage(players.error, t)}</ErrorText>
      ) : (
        <Card className="overflow-hidden">
          {data!.items.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-slate-500">{t('players.empty')}</p>
          ) : (
            <PlayerTable
              players={data!.items}
              onEdit={setEditing}
              onToggleBlock={toggleBlock}
              onRemove={setRemoving}
              busy={update.isPending}
            />
          )}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm">
            <p className="text-slate-500">
              {t('players.showing', {
                from: data!.total === 0 ? 0 : (data!.page - 1) * data!.pageSize + 1,
                to: Math.min(data!.page * data!.pageSize, data!.total),
                total: data!.total,
              })}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" disabled={page * PAGE_SIZE >= data!.total} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {editing && (
        <PlayerFormDialog
          clubId={club.id}
          player={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={(result) =>
            setNotice(result.existingAccount ? t('players.linkedNotice', { phone: result.player.phone }) : null)
          }
        />
      )}
      {removing && <RemovePlayerDialog clubId={club.id} player={removing} onClose={() => setRemoving(null)} />}
    </>
  )
}

function PlayerTable({
  players,
  onEdit,
  onToggleBlock,
  onRemove,
  busy,
}: {
  players: ClubPlayer[]
  onEdit: (player: ClubPlayer) => void
  onToggleBlock: (player: ClubPlayer) => void
  onRemove: (player: ClubPlayer) => void
  busy: boolean
}) {
  const { t, i18n } = useTranslation()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <th className="px-5 py-3">{t('players.colPlayer')}</th>
            <th className="px-4 py-3">{t('players.colEmail')}</th>
            <th className="px-4 py-3 text-right">{t('players.colSessions')}</th>
            <th className="px-4 py-3 text-right">{t('players.colClips')}</th>
            <th className="px-4 py-3">{t('players.colLastPlayed')}</th>
            <th className="px-4 py-3">{t('players.colJoined')}</th>
            <th className="px-4 py-3">{t('players.colStatus')}</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {players.map((player) => {
            const display = player.name ?? player.phone ?? '—'
            return (
              <tr key={player.id} className={player.isBlocked ? 'bg-red-50/30' : ''} data-player-id={player.id}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
<UserAvatar name={display} url={player.avatarUrl} tone={player.isBlocked ? 'muted' : 'amber'} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-medium text-slate-900">
                        {display}
                        {player.note && (
                          <span title={player.note}>
                            <StickyNote className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                      </p>
                      <p className="truncate font-mono text-xs text-slate-500">{player.phone}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{player.email ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{player.sessionsCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{player.clipsCount}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {player.lastPlayedAt ? relativeTime(player.lastPlayedAt, i18n.language) : t('players.never')}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(player.joinedAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' })}
                </td>
                <td className="px-4 py-3">
                  {player.isBlocked ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
                      <ShieldBan className="h-3.5 w-3.5" />
                      {t('players.blocked')}
                    </span>
                  ) : !player.accountActive ? (
                    <span className="text-xs font-medium text-slate-400">{t('players.accountInactive')}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {t('players.active')}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <IconButton label={`${t('players.edit')} ${display}`} title={t('players.edit')} onClick={() => onEdit(player)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={`${player.isBlocked ? t('players.unblock') : t('players.block')} ${display}`}
                      title={player.isBlocked ? t('players.unblock') : t('players.block')}
                      onClick={() => onToggleBlock(player)}
                      disabled={busy}
                      danger={!player.isBlocked}
                    >
                      {player.isBlocked ? <ShieldCheck className="h-4 w-4" /> : <ShieldBan className="h-4 w-4" />}
                    </IconButton>
                    <IconButton label={`${t('players.remove')} ${display}`} title={t('players.remove')} onClick={() => onRemove(player)} danger>
                      <UserMinus className="h-4 w-4" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function IconButton({
  label,
  title,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className={`rounded-lg p-2 text-slate-400 disabled:opacity-40 ${
        danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  )
}

function RemovePlayerDialog({ clubId, player, onClose }: { clubId: string; player: ClubPlayer; onClose: () => void }) {
  const { t } = useTranslation()
  const remove = useRemovePlayer(clubId)
  return (
    <Modal
      size="sm"
      title={t('players.removeTitle')}
      description={t('players.removeText', { name: player.name ?? player.phone })}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(player.id, { onSuccess: onClose })}>
            <UserMinus className="h-4 w-4" />
            {t('players.removeConfirm')}
          </Button>
        </>
      }
    >
      {remove.error && <ErrorText>{playerErrorMessage(remove.error, t)}</ErrorText>}
    </Modal>
  )
}
