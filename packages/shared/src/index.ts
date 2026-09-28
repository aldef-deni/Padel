// Tipe bersama API & web. Mewakili bentuk JSON dari API:
// tanggal dikirim sebagai string ISO 8601, bukan Date.

export type IsoDateString = string;

export const ROLES = ['SUPER_ADMIN', 'CLUB_ADMIN', 'PLAYER'] as const;
export type Role = (typeof ROLES)[number];

export const CLIP_STATUSES = ['PENDING', 'PROCESSING', 'READY', 'FAILED'] as const;
export type ClipStatus = (typeof CLIP_STATUSES)[number];

// ---- Entitas ----

export interface Club {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Court {
  id: string;
  clubId: string;
  name: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Camera {
  id: string;
  courtId: string;
  name: string;
  /** Path MediaMTX, mis. "court-1". */
  streamPath: string;
  isActive: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  role: Role;
  clubId: string | null;
}

// ---- Auth ----

export interface AdminLoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// ---- Input CRUD ----

export interface CreateClubInput {
  name: string;
  slug: string;
  address?: string;
  timezone?: string;
}
export type UpdateClubInput = Partial<CreateClubInput>;

export interface CreateCourtInput {
  clubId: string;
  name: string;
}
export type UpdateCourtInput = Partial<Omit<CreateCourtInput, 'clubId'>>;

export interface CreateCameraInput {
  courtId: string;
  name: string;
  streamPath: string;
  isActive?: boolean;
}
export type UpdateCameraInput = Partial<CreateCameraInput>;

// ---- Status kamera (dari MediaMTX) ----

export interface CameraStatus {
  cameraId: string;
  streamPath: string;
  /** true jika kamera sedang publish ke MediaMTX. */
  online: boolean;
  onlineSince: IsoDateString | null;
  /** Codec track, mis. ["H264", "MPEG-4 Audio"]. */
  tracks: string[];
  /** Info video dari track video pertama, jika ada. */
  video: { codec: string; width: number | null; height: number | null } | null;
  bytesReceived: number;
  readers: number;
}

export interface CameraStatusResponse {
  /** false jika API MediaMTX tidak bisa dihubungi; semua kamera dianggap offline. */
  mediaServerReachable: boolean;
  cameras: CameraStatus[];
}

// ---- Error ----

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}
