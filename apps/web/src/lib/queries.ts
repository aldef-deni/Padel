import type {
  Camera,
  CameraStatusResponse,
  Club,
  Court,
  CreateCameraInput,
  CreateCourtInput,
  UpdateCameraInput,
  UpdateCourtInput,
} from '@padel/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

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
