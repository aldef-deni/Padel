import type { ManagedUser, Role, UserListQuery } from '@padel/shared'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../components/Modal'
import { Button, Card, ErrorText, Input, Loading, PageHeader } from '../components/ui'
import { UserAvatar } from '../components/UserAvatar'
import { UserFormDialog } from '../components/UserFormDialog'
import { useAuth } from '../lib/auth-context'
import { relativeTime } from '../lib/format'
import { useDeleteUser, useUpdateUser, useUsers } from '../lib/queries'
import { roleBadge, userErrorMessage } from '../lib/users'

const PAGE_SIZE = 20
const ROLE_TABS: (Role | 'ALL')[] = ['ALL', 'SUPER_ADMIN', 'CLUB_ADMIN', 'PLAYER']


export function UsersPage() {
  const { t } = useTranslation()
  const [role, setRole] = useState<Role | 'ALL'>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ManagedUser | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ManagedUser | null>(null)

  // Debounce typing; a new search starts on page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const query: UserListQuery = {
    search: search || undefined,
    role: role === 'ALL' ? undefined : role,
    page,
    pageSize: PAGE_SIZE,
  }
  const users = useUsers(query)
  const data = users.data

  return (
    <>
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            {t('users.add')}
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setRole(tab)
                setPage(1)
              }}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                role === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'ALL' ? t('users.all') : t(`roles.${tab}`)}
              <span
                className={`rounded-md px-1.5 text-xs tabular-nums ${role === tab ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-500'}`}
              >
                {data?.counts[tab] ?? '·'}
              </span>
            </button>
          ))}
        </div>
        <div className="w-full lg:w-80">
          <Input
            icon={Search}
            type="search"
            placeholder={t('users.search')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {users.isPending ? (
        <Loading label={t('common.loading')} />
      ) : users.error ? (
        <ErrorText>{userErrorMessage(users.error, t)}</ErrorText>
      ) : (
        <Card className="overflow-hidden">
          {data!.items.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-slate-500">{t('users.empty')}</p>
          ) : (
            <UserTable users={data!.items} onEdit={setEditing} onDelete={setDeleting} />
          )}
          <Pagination
            page={data!.page}
            pageSize={data!.pageSize}
            total={data!.total}
            loading={users.isFetching}
            onPage={setPage}
          />
        </Card>
      )}

      {editing && (
        <UserFormDialog user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
      {deleting && <DeleteUserDialog user={deleting} onClose={() => setDeleting(null)} />}
    </>
  )
}

function UserTable({
  users,
  onEdit,
  onDelete,
}: {
  users: ManagedUser[]
  onEdit: (user: ManagedUser) => void
  onDelete: (user: ManagedUser) => void
}) {
  const { t, i18n } = useTranslation()
  const { user: me } = useAuth()

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <th className="px-5 py-3">{t('users.colUser')}</th>
            <th className="px-4 py-3">{t('users.colRole')}</th>
            <th className="px-4 py-3">{t('users.colClub')}</th>
            <th className="px-4 py-3">{t('users.colPhone')}</th>
            <th className="px-4 py-3">{t('users.colStatus')}</th>
            <th className="px-4 py-3">{t('users.colLastLogin')}</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => {
            const isMe = user.id === me?.id
            const display = user.name ?? user.username ?? user.email ?? user.phone ?? '—'
            const secondary = [user.username && `@${user.username}`, user.email].filter(Boolean).join(' · ')
            return (
              <tr key={user.id} className={`group ${user.isActive ? '' : 'bg-slate-50/60'}`} data-user-id={user.id}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
<UserAvatar name={display} url={user.avatarUrl} tone={user.isActive ? 'emerald' : 'muted'} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-medium text-slate-900">
                        {display}
                        {isMe && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase">
                            {t('users.you')}
                          </span>
                        )}
                      </p>
                      {secondary && <p className="truncate text-xs text-slate-500">{secondary}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${roleBadge[user.role]}`}
                  >
                    {t(`roles.${user.role}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{user.club?.name ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {user.phone ?? <span className="font-sans text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.isActive ? 'text-emerald-700' : 'text-slate-400'}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {user.isActive ? t('users.active') : t('users.inactive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {user.lastLoginAt ? relativeTime(user.lastLoginAt, i18n.language) : t('users.never')}
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(user)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                      title={t('users.edit')}
                      aria-label={`${t('users.edit')} ${display}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(user)}
                      disabled={isMe}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30"
                      title={t('users.delete')}
                      aria-label={`${t('users.delete')} ${display}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

function Pagination({
  page,
  pageSize,
  total,
  loading,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  loading: boolean
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm">
      <p className="text-slate-500">
        {t('users.showing', { from, to, total })}
        {loading && <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{t('users.prev')}</span>
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <span className="hidden sm:inline">{t('users.next')}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function DeleteUserDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const { t } = useTranslation()
  const remove = useDeleteUser()
  const update = useUpdateUser()
  const name = user.name ?? user.username ?? user.email ?? user.phone ?? ''
  const hasClips = /deactivate/i.test(remove.error instanceof Error ? remove.error.message : '')

  return (
    <Modal
      size="sm"
      title={t('users.deleteTitle')}
      description={t('users.deleteText', { name })}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {hasClips && user.isActive ? (
            <Button
              variant="dark"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: user.id, isActive: false }, { onSuccess: onClose })}
            >
              <UserX className="h-4 w-4" />
              {t('users.deactivateInstead')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={remove.isPending || hasClips}
              onClick={() => remove.mutate(user.id, { onSuccess: onClose })}
            >
              <Trash2 className="h-4 w-4" />
              {t('users.deleteConfirm')}
            </Button>
          )}
        </>
      }
    >
      {(remove.error ?? update.error) && <ErrorText>{userErrorMessage(remove.error ?? update.error, t)}</ErrorText>}
    </Modal>
  )
}
