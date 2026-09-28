import type {
  ActiveSessionResponse,
  Camera,
  CameraStatusResponse,
  Clip,
  Club,
  ClubListQuery,
  ClubListResponse,
  ClubOverview,
  CreateClubInput,
  UpdateClubInput,
  Court,
  CreateCameraInput,
  CreateCourtInput,
  CreateUserInput,
  ManagedUser,
  UpdateUserInput,
  UserListQuery,
  UserListResponse,
  RequestReplayInput,
  Session,
  SessionQr,
  TvLink,
  TvSnapshot,
  UpdateCameraInput,
  UpdateCourtInput,
} from '@padel/shared'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api, ApiRequestError } from './api'

export const queryKeys = {
  clubs: ['clubs'] as const,
  courts: (clubId: string) => ['courts', clubId] as const,
  court: (id: string) => ['court', id] as const,
  cameras: (clubId: string) => ['cameras', clubId] as const,
  cameraStatus: (clubId: string) => ['camera-status', clubId] as const,
}

export function useClubs(enabled = true) {
  return useQuery({ queryKey: queryKeys.clubs, queryFn: () => api<Club[]>('/clubs'), enabled })
}

export function useCourts(clubId: string) {
  return useQuery({
    queryKey: queryKeys.courts(clubId),
    queryFn: () => api<Court[]>(`/courts?clubId=${encodeURIComponent(clubId)}`),
  })
}

export function useCourt(id: string) {
  return useQuery({ queryKey: queryKeys.court(id), queryFn: () => api<Court>(`/courts/${id}`) })
}

export function useCameras(clubId: string) {
  return useQuery({
    queryKey: queryKeys.cameras(clubId),
    queryFn: () => api<Camera[]>(`/cameras?clubId=${encodeURIComponent(clubId)}`),
  })
}

/** Live camera status from MediaMTX, polled every 5 seconds. */
export function useCameraStatus(clubId: string) {
  return useQuery({
    queryKey: queryKeys.cameraStatus(clubId),
    queryFn: () => api<CameraStatusResponse>(`/cameras/status?clubId=${encodeURIComponent(clubId)}`),
    refetchInterval: 5000,
  })
}

/** Invalidates everything that depends on a club's courts/cameras. */
function useInvalidateClub(clubId: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.courts(clubId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cameras(clubId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cameraStatus(clubId) }),
      queryClient.invalidateQueries({ queryKey: ['court'] }),
    ])
}

export function useCreateCourt(clubId: string) {
  const invalidate = useInvalidateClub(clubId)
  return useMutation({
    mutationFn: (input: CreateCourtInput) => api<Court>('/courts', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useUpdateCourt(clubId: string) {
  const invalidate = useInvalidateClub(clubId)
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateCourtInput & { id: string }) =>
      api<Court>(`/courts/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteCourt(clubId: string) {
  const invalidate = useInvalidateClub(clubId)
  return useMutation({
    mutationFn: (id: string) => api<void>(`/courts/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

export function useCreateCamera(clubId: string) {
  const invalidate = useInvalidateClub(clubId)
  return useMutation({
    mutationFn: (input: CreateCameraInput) => api<Camera>('/cameras', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useUpdateCamera(clubId: string) {
  const invalidate = useInvalidateClub(clubId)
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateCameraInput & { id: string }) =>
      api<Camera>(`/cameras/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteCamera(clubId: string) {
  const invalidate = useInvalidateClub(clubId)
  return useMutation({
    mutationFn: (id: string) => api<void>(`/cameras/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

// ---- Sesi & replay ----

export const sessionKeys = {
  active: (courtId: string) => ['session', 'active', courtId] as const,
  qr: (sessionId: string) => ['session', 'qr', sessionId] as const,
  clips: (sessionId: string) => ['session', 'clips', sessionId] as const,
}

export function useActiveSession(courtId: string) {
  return useQuery({
    queryKey: sessionKeys.active(courtId),
    queryFn: () => api<ActiveSessionResponse>(`/courts/${courtId}/sessions/active`),
    refetchInterval: 10_000, // player count
  })
}

export function useSessionQr(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.qr(sessionId ?? ''),
    queryFn: () => api<SessionQr>(`/sessions/${sessionId}/qr`),
    enabled: !!sessionId,
    staleTime: Infinity,
  })
}

export function useStartSession(courtId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<Session>(`/courts/${courtId}/sessions`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.active(courtId) }),
  })
}

export function useEndSession(courtId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => api<Session>(`/sessions/${sessionId}/end`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.active(courtId) }),
  })
}

export function useSessionClips(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.clips(sessionId ?? ''),
    queryFn: () => api<Clip[]>(`/sessions/${sessionId}/clips`),
    enabled: !!sessionId,
  })
}

export function useRequestReplay(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RequestReplayInput) =>
      api<Clip[]>(`/sessions/${sessionId}/replays`, { method: 'POST', body: input }),
    onSuccess: (clips) => {
      for (const clip of clips) upsertClip(queryClient, clip)
    },
  })
}

/** Inserts or replaces a clip in the session's cached list (newest first). */
export function upsertClip(queryClient: QueryClient, clip: Clip) {
  queryClient.setQueryData<Clip[]>(sessionKeys.clips(clip.sessionId), (old = []) => {
    const rest = old.filter((c) => c.id !== clip.id)
    return [clip, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })
}

// ---- Layar TV ----

export function useTvLink(clubId: string) {
  return useQuery({ queryKey: ['tv-link', clubId], queryFn: () => api<TvLink>(`/clubs/${clubId}/tv-link`) })
}

export function useRotateTvLink(clubId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<TvLink>(`/clubs/${clubId}/tv-link`, { method: 'POST' }),
    onSuccess: (link) => queryClient.setQueryData(['tv-link', clubId], link),
  })
}

export function useUploadLogo(clubId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData()
      body.append('file', file)
      return api<Club>(`/clubs/${clubId}/logo`, { method: 'POST', body })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clubs }),
  })
}

export function useRemoveLogo(clubId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/clubs/${clubId}/logo`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clubs }),
  })
}

/** Public TV data, authorized by the key in the TV link. Refreshed every 5 minutes. */
export function useTvSnapshot(clubId: string, key: string) {
  return useQuery({
    queryKey: ['tv', clubId, key],
    queryFn: () => api<TvSnapshot>(`/tv/${clubId}?key=${encodeURIComponent(key)}`),
    refetchInterval: 5 * 60_000,
    retry: (failureCount, error) =>
      !(error instanceof ApiRequestError && error.status === 401) && failureCount < 5,
  })
}

/** Dashboard numbers (active sessions, today's replays, latest clips), refreshed every 15 s. */
export function useClubOverview(clubId: string) {
  return useQuery({
    queryKey: ['club-overview', clubId],
    queryFn: () => api<ClubOverview>(`/clubs/${clubId}/overview`),
    refetchInterval: 15_000,
  })
}

// ---- Pengguna (SUPER_ADMIN) ----

export function useUsers(query: UserListQuery) {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.role) params.set('role', query.role)
  if (query.clubId) params.set('clubId', query.clubId)
  params.set('page', String(query.page ?? 1))
  params.set('pageSize', String(query.pageSize ?? 20))
  return useQuery({
    queryKey: ['users', query],
    queryFn: () => api<UserListResponse>(`/users?${params}`),
    placeholderData: keepPreviousData,
  })
}

function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['users'] })
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: CreateUserInput) => api<ManagedUser>('/users', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateUserInput & { id: string }) =>
      api<ManagedUser>(`/users/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}

// ---- Klub (SUPER_ADMIN) ----

export function useClubsStats(query: ClubListQuery) {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.status) params.set('status', query.status)
  params.set('page', String(query.page ?? 1))
  params.set('pageSize', String(query.pageSize ?? 12))
  return useQuery({
    queryKey: ['clubs', 'stats', query],
    queryFn: () => api<ClubListResponse>(`/clubs/stats?${params}`),
    placeholderData: keepPreviousData,
  })
}

export function useClubDetail(id: string) {
  return useQuery({ queryKey: ['clubs', 'detail', id], queryFn: () => api<Club>(`/clubs/${id}`) })
}

/** Every club query starts with ['clubs'], so one invalidation refreshes lists, details and the switcher. */
function useInvalidateClubs() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['clubs'] })
}

export function useCreateClub() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: (input: CreateClubInput) => api<Club>('/clubs', { method: 'POST', body: input }),
    onSuccess: invalidate,
  })
}

export function useUpdateClub() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateClubInput & { id: string }) =>
      api<Club>(`/clubs/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  })
}

export function useDeleteClub() {
  const invalidate = useInvalidateClubs()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/clubs/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
}
