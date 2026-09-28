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
  city: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  /** Username Instagram tanpa "@". */
  instagram: string | null;
  mapsUrl: string | null;
  /** Jam operasional "HH:mm" di zona waktu klub. */
  openTime: string | null;
  closeTime: string | null;
  /** false = klub dinonaktifkan (admin klub tidak bisa login, sesi/replay/TV berhenti). */
  isActive: boolean;
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
  /** URL foto profil (publik), null jika belum diunggah. */
  avatarUrl: string | null;
  lastLoginAt: IsoDateString | null;
  createdAt: IsoDateString;
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

/** Hasil POST /api/auth/email/request: kode masuk pemain dikirim ke email. */
export interface EmailCodeRequested {
  email: string;
  expiresInSec: number;
  resendInSec: number;
}

/** PATCH /api/auth/me — profil sendiri. Pemain tidak bisa mengganti nomor/email login di sini. */
export interface UpdateProfileInput {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
}

// ---- Input CRUD ----

export interface CreateClubInput {
  name: string;
  slug: string;
  address?: string | null;
  timezone?: string;
  city?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  mapsUrl?: string | null;
  openTime?: string | null;
  closeTime?: string | null;
  /** Hanya SUPER_ADMIN. */
  isActive?: boolean;
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
  /** Rekaman berjalan di MediaMTX (buffer untuk replay). */
  recording: CameraRecording;
}

export interface CameraRecording {
  /** true jika kamera online sehingga rekaman sedang ditulis. */
  active: boolean;
  /** Awal rekaman tertua yang masih tersimpan (replay bisa diambil sejak waktu ini). */
  availableFrom: IsoDateString | null;
  /** Jumlah segmen rekaman di disk. */
  segments: number;
}

export interface CameraStatusResponse {
  /** false jika API MediaMTX tidak bisa dihubungi; semua kamera dianggap offline. */
  mediaServerReachable: boolean;
  /** Rekaman lebih tua dari ini dihapus otomatis oleh MediaMTX. */
  recordRetentionHours: number;
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
  /** Ukuran file tersimpan (byte), jika READY. */
  sizeBytes: number | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** Klip di pustaka replay admin (semua sesi klub). */
export interface ClipLibraryItem extends Clip {
  court: { id: string; name: string };
  camera: { id: string; name: string };
  requestedBy: { id: string; name: string | null; avatarUrl: string | null };
  session: { id: string; startedAt: IsoDateString; endedAt: IsoDateString | null };
}

export interface ClipLibraryQuery {
  clubId?: string;
  courtId?: string;
  status?: ClipStatus;
  /** Tanggal lokal klub, YYYY-MM-DD (inklusif). */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface ClipLibraryStats {
  total: number;
  ready: number;
  failed: number;
  inProgress: number;
  today: number;
  /** Total ukuran file klip tersimpan (byte). */
  storageBytes: number;
}

export interface ClipLibraryResponse {
  items: ClipLibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  stats: ClipLibraryStats;
}

// ---- Konfigurasi publik aplikasi ----

export interface AppConfig {
  /** Terisi hanya di instance demo (demo.padel.aldeftech.com). */
  demo: {
    username: string;
    password: string;
    /** Reset data berikutnya. */
    resetAt: IsoDateString;
  } | null;
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

// ---- Kelola pengguna (SUPER_ADMIN) ----

/** Pengguna seperti dilihat SUPER_ADMIN di menu Pengguna. */
export interface ManagedUser extends User {
  isActive: boolean;
  /** true jika akun punya password (admin). */
  hasPassword: boolean;
  lastLoginAt: IsoDateString | null;
  club: { id: string; name: string } | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface UserListQuery {
  search?: string;
  role?: Role;
  clubId?: string;
  page?: number;
  pageSize?: number;
}

export interface UserListResponse {
  items: ManagedUser[];
  total: number;
  page: number;
  pageSize: number;
  /** Jumlah per role untuk pencarian yang sama (tanpa filter role). */
  counts: Record<Role | 'ALL', number>;
}

/**
 * SUPER_ADMIN / CLUB_ADMIN: username atau email + password (min. 12). CLUB_ADMIN wajib clubId.
 * PLAYER: phone wajib (login OTP), tanpa password.
 */
export interface CreateUserInput {
  role: Role;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  password?: string;
  clubId?: string | null;
  isActive?: boolean;
}

/** Field yang tidak dikirim tidak berubah; null mengosongkan field. */
export type UpdateUserInput = Partial<CreateUserInput>;

// ---- Kelola klub (SUPER_ADMIN) ----

export interface ClubStats {
  courts: number;
  cameras: number;
  admins: number;
  activeSessions: number;
  /** Klip yang diminta 30 hari terakhir. */
  clips30d: number;
}

export interface ClubWithStats extends Club {
  stats: ClubStats;
}

export interface ClubListQuery {
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  page?: number;
  pageSize?: number;
}

export interface ClubListResponse {
  items: ClubWithStats[];
  total: number;
  page: number;
  pageSize: number;
  counts: { ALL: number; ACTIVE: number; INACTIVE: number };
}

// ---- Pemain klub (CLUB_ADMIN / SUPER_ADMIN) ----

/** Pemain yang terdaftar di klub (akun PLAYER global + keanggotaan klub). */
export interface ClubPlayer {
  /** ID akun (User). */
  id: string;
  name: string | null;
  avatarUrl: string | null;
  phone: string | null;
  email: string | null;
  /** Status akun global (dinonaktifkan SUPER_ADMIN). */
  accountActive: boolean;
  /** Diblokir di klub ini: tidak bisa join sesi di sini. */
  isBlocked: boolean;
  /** Catatan internal admin klub. */
  note: string | null;
  joinedAt: IsoDateString;
  lastLoginAt: IsoDateString | null;
  /** Jumlah sesi yang diikuti di klub ini. */
  sessionsCount: number;
  /** Jumlah replay yang diminta di klub ini. */
  clipsCount: number;
  lastPlayedAt: IsoDateString | null;
}

export interface ClubPlayerListQuery {
  search?: string;
  status?: 'ACTIVE' | 'BLOCKED';
  page?: number;
  pageSize?: number;
}

export interface ClubPlayerListResponse {
  items: ClubPlayer[];
  total: number;
  page: number;
  pageSize: number;
  counts: { ALL: number; ACTIVE: number; BLOCKED: number };
}

export interface CreateClubPlayerInput {
  /** Nomor HP dan/atau email (minimal salah satu). Akun yang sudah terdaftar ditautkan ke klub. */
  phone?: string | null;
  name?: string | null;
  email?: string | null;
  note?: string | null;
}

export interface CreateClubPlayerResponse {
  player: ClubPlayer;
  /** true = nomor sudah punya akun (mis. main di klub lain); hanya ditambahkan ke klub ini. */
  existingAccount: boolean;
}

export interface UpdateClubPlayerInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  isBlocked?: boolean;
}

// ---- Turnamen ----

export const TOURNAMENT_FORMATS = ['SINGLE_ELIMINATION', 'ROUND_ROBIN', 'GROUPS_KNOCKOUT'] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];
export const TOURNAMENT_STATUSES = ['DRAFT', 'REGISTRATION', 'ONGOING', 'COMPLETED', 'CANCELLED'] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];
export type TournamentTeamStatus = 'REGISTERED' | 'CONFIRMED' | 'WITHDRAWN';
export type TournamentStage = 'GROUP' | 'KNOCKOUT';
export type TournamentMatchStatus = 'SCHEDULED' | 'COMPLETED' | 'WALKOVER' | 'BYE';

export interface SetScore {
  a: number;
  b: number;
}

/** Pengaturan yang bisa diubah admin. */
export interface TournamentSettings {
  name: string;
  category: string | null;
  description: string | null;
  /** Tanggal ISO (YYYY-MM-DD atau datetime). */
  startDate: IsoDateString;
  endDate: IsoDateString | null;
  registrationDeadline: IsoDateString | null;
  format: TournamentFormat;
  maxTeams: number | null;
  /** Rupiah. */
  entryFee: number | null;
  prizeInfo: string | null;
  isPublic: boolean;
  /** 1 = satu set, 2 = best of 3. */
  setsToWin: number;
  /** 4, 6 atau 9 game per set. */
  gamesPerSet: number;
  /** Set penentu = super tie-break sampai 10. */
  superTiebreak: boolean;
  goldenPoint: boolean;
  groupCount: number;
  advancePerGroup: number;
  thirdPlaceMatch: boolean;
}

export interface TournamentSummary extends TournamentSettings {
  id: string;
  clubId: string;
  club: { id: string; name: string; logoUrl: string | null };
  /** URL publik: /t/<slug> */
  slug: string;
  status: TournamentStatus;
  /** Tim aktif (tidak termasuk yang mundur). */
  teamCount: number;
  matchCount: number;
  finishedMatchCount: number;
  championName: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface TournamentTeam {
  id: string;
  name: string;
  player1Name: string;
  player2Name: string;
  /** Hanya untuk admin; null di halaman publik. */
  player1Id: string | null;
  player2Id: string | null;
  seed: number | null;
  status: TournamentTeamStatus;
  paid: boolean;
  note: string | null;
  groupId: string | null;
}

export interface TournamentStandingRow {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
}

export interface TournamentGroup {
  id: string;
  name: string;
  order: number;
  standings: TournamentStandingRow[];
}

export interface TournamentMatch {
  id: string;
  stage: TournamentStage;
  groupId: string | null;
  round: number;
  position: number;
  teamAId: string | null;
  teamBId: string | null;
  court: { id: string; name: string } | null;
  scheduledAt: IsoDateString | null;
  status: TournamentMatchStatus;
  sets: SetScore[] | null;
  winnerId: string | null;
  nextMatchId: string | null;
  isThirdPlace: boolean;
}

export interface TournamentDetail extends TournamentSummary {
  teams: TournamentTeam[];
  groups: TournamentGroup[];
  matches: TournamentMatch[];
  /** Jumlah babak sistem gugur (0 jika belum ada). */
  knockoutRounds: number;
  championTeamId: string | null;
}

export interface TournamentListQuery {
  clubId?: string;
  status?: TournamentStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface TournamentListResponse {
  items: TournamentSummary[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<TournamentStatus | 'ALL', number>;
}

export type CreateTournamentInput = Partial<Omit<TournamentSettings, 'name' | 'startDate' | 'format'>> &
  Pick<TournamentSettings, 'name' | 'startDate' | 'format'> & { clubId: string };
export type UpdateTournamentInput = Partial<TournamentSettings>;

export interface TournamentTeamInput {
  /** Default: "Pemain 1 / Pemain 2". */
  name?: string | null;
  player1Name: string;
  player2Name: string;
  player1Id?: string | null;
  player2Id?: string | null;
  seed?: number | null;
  status?: TournamentTeamStatus;
  paid?: boolean;
  note?: string | null;
}

export interface ScheduleMatchInput {
  courtId?: string | null;
  scheduledAt?: IsoDateString | null;
}

/** Salah satu: skor per set, atau walkover untuk tim A/B. */
export interface MatchResultInput {
  sets?: SetScore[];
  walkover?: 'A' | 'B';
}
