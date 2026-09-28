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
  /** URL logo klub (publik), null jika belum diunggah. */
  logoUrl: string | null;
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
  username: string | null;
  phone: string | null;
  name: string | null;
  role: Role;
  clubId: string | null;
}

// ---- Auth ----

export interface AdminLoginInput {
  /** Email atau username. */
  login: string;
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

// ---- Sesi & replay ----

export interface Session {
  id: string;
  courtId: string;
  /** Token di QR lapangan; pemain scan untuk bergabung. */
  qrToken: string;
  startedAt: IsoDateString;
  /** null = sesi masih aktif. */
  endedAt: IsoDateString | null;
  playerCount: number;
}

export interface ActiveSessionResponse {
  session: Session | null;
}

export interface SessionQr {
  qrToken: string;
  /** URL yang dikodekan di QR (dibuka aplikasi pemain). */
  joinUrl: string;
  /** Gambar QR sebagai SVG. */
  svg: string;
}

export interface JoinSessionInput {
  qrToken: string;
}

export interface JoinSessionResponse {
  session: Session;
  court: { id: string; name: string };
  club: { id: string; name: string };
}

export interface RequestReplayInput {
  /** Panjang replay ke belakang dari saat tombol ditekan (detik). Default 30. */
  durationSec?: number;
}

export interface Clip {
  id: string;
  sessionId: string;
  cameraId: string;
  requestedById: string;
  /** Awal potongan rekaman. */
  startAt: IsoDateString;
  durationSec: number;
  status: ClipStatus;
  error: string | null;
  /** URL video bertanda tangan (sementara), hanya jika status READY. */
  downloadUrl: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

// ---- Socket.IO (path /socket.io) ----

/** Client -> server: berlangganan event sesi. Auth: handshake `auth: { token }`. */
export const SOCKET_SUBSCRIBE_SESSION = 'session:subscribe';
/** Server -> client: klip dibuat atau statusnya berubah. */
export const SOCKET_CLIP_UPDATED = 'clip:updated';

export interface SubscribeSessionPayload {
  sessionId: string;
}

export type SubscribeSessionAck = { ok: true } | { ok: false; error: string };

// ---- Layar TV (kiosk) ----

export interface TvLink {
  /** URL layar TV berisi kunci rahasia; null jika belum pernah dibuat. */
  url: string | null;
}

/** Data awal layar TV: GET /api/tv/:clubId?key=... */
export interface TvSnapshot {
  club: { id: string; name: string; logoUrl: string | null };
  courts: { id: string; name: string }[];
  cameras: { id: string; courtId: string; name: string }[];
  /** Klip READY terbaru klub (maks. 10, terbaru dulu). */
  recentClips: Clip[];
}

/**
 * Handshake Socket.IO untuk layar TV (pengganti `auth: { token }`).
 * Socket otomatis masuk room klub dan menerima `clip:updated` semua lapangan klub itu.
 */
export interface TvSocketAuth {
  clubId: string;
  tvKey: string;
}

// ---- Dashboard ----

export interface RecentClip extends Clip {
  courtId: string;
  courtName: string;
  cameraName: string;
}

/** GET /api/clubs/:id/overview */
export interface ClubOverview {
  activeSessions: {
    sessionId: string;
    courtId: string;
    startedAt: IsoDateString;
    playerCount: number;
  }[];
  /** Klip yang diminta hari ini (zona waktu klub). */
  clipsToday: { total: number; ready: number; failed: number };
  /** 8 klip terbaru klub, semua status. */
  recentClips: RecentClip[];
}
