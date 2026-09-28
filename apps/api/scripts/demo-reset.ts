/**
 * Resets the demo instance (demo.padel.aldeftech.com) to a fresh, realistic data set:
 * clubs, courts, cameras (court-demo-* streams from infra/demo), admins, players,
 * two weeks of sessions with replay clips, and tournaments in every stage.
 *
 *   ENV_FILE=.env.demo pnpm demo:reset
 *
 * Refuses to run unless DEMO_MODE=true, the database name contains "demo" and every data
 * directory / queue prefix is a demo one, so it can never touch production data.
 * Random choices come from a fixed seed; dates are relative to now.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: process.env.ENV_FILE ?? '.env', quiet: true });

import { PrismaPg } from '@prisma/adapter-pg';
import { Queue } from 'bullmq';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { link, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AuthUser } from '../src/auth/auth-user.js';
import { hashPassword } from '../src/auth/password.js';
import { DEMO_PASSWORD, DEMO_USERNAME } from '../src/demo/demo.service.js';
import {
  ClipStatus,
  PrismaClient,
  Role,
  type Camera,
  type Club,
  type Court,
  type User,
} from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { TournamentsService } from '../src/tournaments/tournaments.service.js';

const env = (key: string) => {
  const value = process.env[key];
  if (!value) fail(`${key} belum di-set`);
  return value;
};
function fail(message: string): never {
  console.error(`demo-reset: ${message}`);
  process.exit(1);
}

// ---- Safety ----
if (process.env.DEMO_MODE !== 'true')
  fail('DEMO_MODE=true wajib (jalankan dengan ENV_FILE=.env.demo)');
const DATABASE_URL = env('DATABASE_URL');
if (!new URL(DATABASE_URL).pathname.includes('demo'))
  fail('nama database harus mengandung "demo"');
const DIRS = {
  clips: env('CLIPS_DIR'),
  logos: env('LOGOS_DIR'),
  avatars: env('AVATARS_DIR'),
};
for (const dir of Object.values(DIRS))
  if (!dir.includes('/demo/')) fail(`direktori bukan direktori demo: ${dir}`);
const PREFIX = env('BULLMQ_PREFIX');
if (!PREFIX.includes('demo')) fail('BULLMQ_PREFIX harus mengandung "demo"');
const SAMPLES_DIR =
  process.env.DEMO_SAMPLES_DIR ?? '/opt/padel/data/demo/video/samples';
const TZ_OFFSET_H = 7; // Asia/Jakarta, no DST.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

// ---- Deterministic randomness ----
let seed = 20260928;
function rand() {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
function sample<T>(items: readonly T[], n: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

const NOW = new Date();
const MIN = 60_000;
/** Local (WIB) midnight `daysAgo` days back, as a UTC Date. */
function localMidnight(daysAgo: number): Date {
  const local = new Date(NOW.getTime() + TZ_OFFSET_H * 3600_000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - TZ_OFFSET_H * 3600_000 - daysAgo * 86_400_000);
}
const at = (daysAgo: number, hour: number, minute = 0) =>
  new Date(localMidnight(daysAgo).getTime() + (hour * 60 + minute) * MIN);
const isoDate = (daysFromToday: number) =>
  new Date(localMidnight(-daysFromToday).getTime() + TZ_OFFSET_H * 3600_000).toISOString().slice(0, 10);

// ---- Reset ----
async function wipe() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  for (const dir of Object.values(DIRS)) {
    await mkdir(dir, { recursive: true });
    for (const file of await readdir(dir)) await rm(join(dir, file), { force: true, recursive: true });
  }
  const queue = new Queue('clips', { connection: { url: env('REDIS_URL') }, prefix: PREFIX });
  await queue.obliterate({ force: true });
  await queue.close();
}

// ---- People ----
const FIRST = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hana', 'Indra', 'Joko', 'Kevin', 'Lestari', 'Maya', 'Nadia', 'Oscar', 'Putri', 'Raka', 'Sari', 'Tono', 'Umar', 'Vina', 'Wahyu', 'Yusuf', 'Zahra', 'Bayu', 'Clara', 'Dimas', 'Farah', 'Galih', 'Intan', 'Reza', 'Salsa', 'Teguh', 'Wulan', 'Arief', 'Nabila'];
const LAST = ['Pratama', 'Santoso', 'Wijaya', 'Kusuma', 'Saputra', 'Lestari', 'Hidayat', 'Nugroho', 'Permata', 'Setiawan', 'Halim', 'Siregar', 'Gunawan', 'Utami', 'Firmansyah', 'Anggraini', 'Wibowo', 'Maharani'];

async function createPlayers(count: number) {
  const players: User[] = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    players.push(
      await prisma.user.create({
        data: {
          role: Role.PLAYER,
          name: `${first} ${last}`,
          email: `${first}.${last}${i}`.toLowerCase() + '@example.com',
          phone: `+62812${String(55500000 + i * 137).padStart(8, '0')}`,
          lastLoginAt: new Date(NOW.getTime() - int(1, 20 * 24 * 60) * MIN),
          createdAt: new Date(NOW.getTime() - int(20, 120) * 86_400_000),
        },
      }),
    );
  }
  return players;
}

async function createAdmin(club: Club, username: string, name: string) {
  return prisma.user.create({
    data: {
      role: Role.CLUB_ADMIN,
      username,
      name,
      email: `${username}@example.com`,
      passwordHash: await hashPassword(randomBytes(18).toString('base64url')),
      clubId: club.id,
      lastLoginAt: new Date(NOW.getTime() - int(30, 3 * 24 * 60) * MIN),
    },
  });
}

// ---- Clubs ----
function renderLogo(file: string, color: string, initials: string) {
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `color=c=${color}:s=256x256`,
    '-vf',
    [
      `drawbox=x=18:y=18:w=220:h=220:color=white@0.18:t=6`,
      `drawtext=fontfile=${font}:text='${initials}':fontsize=96:fontcolor=white:x=(w-text_w)/2:y=62`,
      `drawtext=fontfile=${font}:text='PADEL':fontsize=30:fontcolor=white@0.85:x=(w-text_w)/2:y=176`,
    ].join(','),
    '-frames:v', '1', file,
  ]);
}

interface ClubSetup {
  club: Club;
  courts: { court: Court; camera: Camera }[];
}

async function createClub(opts: {
  name: string;
  slug: string;
  city: string;
  address: string;
  description: string;
  phone: string;
  instagram: string;
  color: string;
  initials: string;
  isActive?: boolean;
  courts: { name: string; streamPath: string; cameraName?: string; active?: boolean }[];
  withTv?: boolean;
}): Promise<ClubSetup> {
  const club = await prisma.club.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      city: opts.city,
      address: opts.address,
      description: opts.description,
      phone: opts.phone,
      email: `halo@${opts.slug}.example`,
      website: `https://${opts.slug}.example`,
      instagram: opts.instagram,
      mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(opts.address)}`,
      openTime: '06:00',
      closeTime: '23:00',
      isActive: opts.isActive ?? true,
      tvKey: opts.withTv ? randomBytes(24).toString('base64url') : null,
      createdAt: new Date(NOW.getTime() - int(60, 200) * 86_400_000),
    },
  });
  const logoFile = `${club.id}-${Date.now()}.png`;
  renderLogo(join(DIRS.logos, logoFile), opts.color, opts.initials);
  await prisma.club.update({ where: { id: club.id }, data: { logoFile } });

  const courts = [];
  for (const c of opts.courts) {
    const court = await prisma.court.create({ data: { clubId: club.id, name: c.name } });
    const camera = await prisma.camera.create({
      data: {
        courtId: court.id,
        name: c.cameraName ?? 'Kamera Utama',
        streamPath: c.streamPath,
        isActive: c.active ?? true,
      },
    });
    courts.push({ court, camera });
  }
  return { club, courts };
}

// ---- Sessions & clips ----
interface Samples {
  files: string[];
  sizes: number[];
}

async function loadSamples(): Promise<Samples> {
  const files = (await readdir(SAMPLES_DIR).catch(() => [] as string[]))
    .filter((f) => f.endsWith('.mp4'))
    .sort()
    .map((f) => join(SAMPLES_DIR, f));
  if (!files.length) fail(`tidak ada klip contoh di ${SAMPLES_DIR} (jalankan infra/demo/render-video.sh)`);
  const sizes = await Promise.all(files.map(async (f) => (await stat(f)).size));
  return { files, sizes };
}

let clipCount = 0;
async function createClip(
  samples: Samples,
  sessionId: string,
  camera: Camera,
  requestedById: string,
  createdAt: Date,
  failed = false,
) {
  const clip = await prisma.clip.create({
    data: {
      sessionId,
      cameraId: camera.id,
      requestedById,
      startAt: new Date(createdAt.getTime() - 30_000),
      durationSec: 30,
      status: failed ? ClipStatus.FAILED : ClipStatus.READY,
      error: failed ? 'No recording for this time range (camera offline?). Playback server HTTP 404' : null,
      createdAt,
      updatedAt: new Date(createdAt.getTime() + int(4, 9) * 1000),
    },
  });
  clipCount++;
  if (failed) return;
  const i = int(0, samples.files.length - 1);
  const file = join(DIRS.clips, `${clip.id}.mp4`);
  await link(samples.files[i], file); // hard link: no extra disk space
  await prisma.clip.update({
    where: { id: clip.id },
    data: { url: pathToFileURL(file).href, sizeBytes: samples.sizes[i] },
  });
}

let sessionCount = 0;
async function createSession(
  samples: Samples,
  setup: { court: Court; camera: Camera },
  members: User[],
  start: Date,
  end: Date | null,
) {
  const players = sample(members, int(2, 4));
  const session = await prisma.session.create({
    data: {
      courtId: setup.court.id,
      qrToken: randomBytes(16).toString('base64url'),
      startedAt: start,
      endedAt: end,
      createdAt: start,
    },
  });
  sessionCount++;
  await prisma.sessionPlayer.createMany({
    data: players.map((p, i) => ({
      sessionId: session.id,
      userId: p.id,
      joinedAt: new Date(start.getTime() + i * int(1, 4) * MIN),
    })),
  });
  const until = Math.min((end ?? NOW).getTime(), NOW.getTime() - 2 * MIN);
  const span = until - start.getTime() - 8 * MIN;
  if (span <= 0) return;
  const replays = int(0, 10) < 2 ? 0 : int(1, 5);
  const times = Array.from({ length: replays }, () => start.getTime() + 8 * MIN + rand() * span).sort((a, b) => a - b);
  for (const time of times)
    await createClip(samples, session.id, setup.camera, pick(players).id, new Date(time), rand() < 0.04);
}

/** Two weeks of court bookings; live courts get a running session now. */
async function createHistory(samples: Samples, setup: ClubSetup, members: User[], busy: number, liveCourts: number) {
  for (const [index, entry] of setup.courts.entries()) {
    const live = index < liveCourts;
    for (let day = 13; day >= 0; day--) {
      let minute = 7 * 60 + int(0, 3) * 15;
      while (minute < 22 * 60) {
        const duration = pick([60, 90, 90, 120]);
        const start = at(day, 0, minute);
        const end = new Date(start.getTime() + duration * MIN);
        // Keep the last 40 minutes free on live courts for the running session.
        const blocked = live && end.getTime() > NOW.getTime() - 40 * MIN;
        if (end <= NOW && !blocked && rand() < busy) await createSession(samples, entry, members, start, end);
        minute += duration + pick([0, 0, 15, 30]);
      }
    }
    if (live) {
      const start = new Date(NOW.getTime() - (index === 0 ? 35 : 12) * MIN);
      await createSession(samples, entry, members, start, null);
    }
  }
}

// ---- Tournaments ----
const WIN_SETS: [number, number][] = [[6, 0], [6, 1], [6, 2], [6, 3], [6, 3], [6, 4], [6, 4], [7, 5], [7, 6]];
function score(winner: 'A' | 'B') {
  const set = () => {
    const [w, l] = pick(WIN_SETS);
    return winner === 'A' ? { a: w, b: l } : { a: l, b: w };
  };
  const lost = () => {
    const [w, l] = pick(WIN_SETS);
    return winner === 'A' ? { a: l, b: w } : { a: w, b: l };
  };
  if (rand() < 0.62) return [set(), set()];
  const [w, l] = pick([[10, 6], [10, 7], [10, 8], [11, 9], [10, 4], [12, 10]] as const);
  const stb = winner === 'A' ? { a: w, b: l } : { a: l, b: w };
  return rand() < 0.5 ? [set(), lost(), stb] : [lost(), set(), stb];
}

async function createTournaments(setup: ClubSetup, members: User[], superAdmin: User, kind: 'main' | 'bali') {
  const service = new TournamentsService(prisma as unknown as PrismaService);
  const actor: AuthUser = { id: superAdmin.id, role: Role.SUPER_ADMIN, clubId: null };
  const courtIds = setup.courts.map((c) => c.court.id);
  const pairs = (n: number) => {
    const people = sample(members, n * 2);
    return Array.from({ length: n }, (_, i) => [people[2 * i], people[2 * i + 1]] as const);
  };
  const addTeams = async (id: string, n: number, seeded: number) => {
    for (const [i, [p1, p2]] of pairs(n).entries())
      await service.addTeam(actor, id, {
        player1Name: p1.name!,
        player2Name: p2.name!,
        player1Id: p1.id,
        player2Id: p2.id,
        seed: i < seeded ? i + 1 : null,
        status: rand() < 0.7 ? 'CONFIRMED' : 'REGISTERED',
        paid: rand() < 0.85,
      });
  };
  /**
   * Plays open matches in bracket order, starting `firstDay` days ago (six slots a day).
   * After `limit` results the remaining playable matches are scheduled for the coming days.
   */
  const play = async (id: string, firstDay: number, limit = Infinity) => {
    for (let slot = 0; ; slot++) {
      const t = await service.get(actor, id);
      const open = t.matches
        .filter((m) => m.status === 'SCHEDULED' && m.teamAId && m.teamBId)
        .sort((a, b) => a.stage.localeCompare(b.stage) || a.round - b.round || a.position - b.position);
      if (!open.length) return;
      if (slot >= limit) {
        for (const [i, m] of open.entries())
          await service.schedule(actor, id, m.id, {
            courtId: courtIds[i % courtIds.length],
            scheduledAt: at(i < 2 ? 0 : -1 - Math.floor((i - 2) / 4), i < 2 ? 20 + i : 18 + ((i - 2) % 4)).toISOString(),
          });
        return;
      }
      const next = open[0];
      await service.schedule(actor, id, next.id, {
        courtId: courtIds[slot % courtIds.length],
        scheduledAt: at(firstDay - Math.floor(slot / 6), 9, (slot % 6) * 90).toISOString(),
      });
      const walkover = rand() < 0.05;
      await service.recordResult(
        actor,
        id,
        next.id,
        walkover ? { walkover: pick(['A', 'B'] as const) } : { sets: score(rand() < 0.55 ? 'A' : 'B') },
      );
    }
  };

  if (kind === 'bali') {
    const cup = await service.create(actor, {
      clubId: setup.club.id, name: 'Bali Sunset Cup', category: 'Mixed Open', format: 'SINGLE_ELIMINATION',
      startDate: isoDate(-2), endDate: isoDate(1), entryFee: 400000, prizeInfo: 'Voucher menginap 2 malam + trofi',
      description: 'Turnamen santai menjelang matahari terbenam di Canggu.', maxTeams: 8,
    });
    await service.setStatus(actor, cup.id, 'REGISTRATION');
    await addTeams(cup.id, 6, 2);
    await service.draw(actor, cup.id, { shuffle: true });
    await play(cup.id, 2, 3);
    return;
  }

  const open = await service.create(actor, {
    clubId: setup.club.id, name: 'Aldef Open 2026', category: 'Men Open', format: 'SINGLE_ELIMINATION',
    startDate: isoDate(-12), endDate: isoDate(-11), registrationDeadline: isoDate(-15), maxTeams: 8, entryFee: 300000,
    prizeInfo: 'Total hadiah Rp 10 juta + trofi', thirdPlaceMatch: true,
    description: 'Turnamen tahunan klub. Format sistem gugur, perebutan juara 3, set penentu super tie-break.',
  });
  await service.setStatus(actor, open.id, 'REGISTRATION');
  await addTeams(open.id, 8, 4);
  await service.draw(actor, open.id, { shuffle: true });
  await play(open.id, 12);

  const league = await service.create(actor, {
    clubId: setup.club.id, name: 'Liga Mixed Oktober', category: 'Mixed B', format: 'GROUPS_KNOCKOUT',
    startDate: isoDate(-5), endDate: isoDate(9), maxTeams: 8, entryFee: 250000, groupCount: 2, advancePerGroup: 2,
    prizeInfo: 'Trofi + merchandise', description: 'Dua grup berisi empat tim, dua teratas tiap grup lolos ke semifinal.',
  });
  await service.setStatus(actor, league.id, 'REGISTRATION');
  await addTeams(league.id, 8, 2);
  await service.draw(actor, league.id, { shuffle: true });
  await play(league.id, 5, 9);

  const beginners = await service.create(actor, {
    clubId: setup.club.id, name: 'Turnamen Pemula November', category: 'Beginner', format: 'ROUND_ROBIN',
    startDate: isoDate(20), registrationDeadline: isoDate(15), maxTeams: 8, entryFee: 150000, setsToWin: 1,
    prizeInfo: 'Medali + sesi coaching gratis', description: 'Untuk pemain baru: satu set per pertandingan, semua bertemu semua.',
  });
  await service.setStatus(actor, beginners.id, 'REGISTRATION');
  await addTeams(beginners.id, 5, 0);

  await service.create(actor, {
    clubId: setup.club.id, name: 'Women Cup 2026', category: 'Women Open', format: 'SINGLE_ELIMINATION',
    startDate: isoDate(40), endDate: isoDate(41), maxTeams: 16, entryFee: 300000, thirdPlaceMatch: true,
  });
}

// ---- Main ----
async function main() {
  const started = Date.now();
  const samples = await loadSamples();
  await wipe();

  const demo = await prisma.user.create({
    data: { role: Role.SUPER_ADMIN, username: DEMO_USERNAME, name: 'Akun Demo', passwordHash: await hashPassword(DEMO_PASSWORD) },
  });

  const arena = await createClub({
    name: 'Aldef Padel Arena', slug: 'aldef-padel-arena', city: 'Jakarta Selatan', address: 'Jl. Kemang Raya No. 12, Jakarta Selatan',
    description: 'Empat lapangan panoramic kaca dengan kamera replay di setiap lapangan. Buka setiap hari.',
    phone: '+62 21 5550 1234', instagram: '@aldefpadel.arena', color: '0x0f766e', initials: 'AP', withTv: true,
    courts: [
      { name: 'Lapangan 1', streamPath: 'court-demo-1' },
      { name: 'Lapangan 2', streamPath: 'court-demo-2' },
      { name: 'Lapangan 3', streamPath: 'court-demo-3' },
      { name: 'Lapangan 4 (Indoor)', streamPath: 'court-demo-4', cameraName: 'Kamera Baseline' },
    ],
  });
  const bali = await createClub({
    name: 'Aldef Padel Bali', slug: 'aldef-padel-bali', city: 'Badung, Bali', address: 'Jl. Pantai Batu Bolong, Canggu, Bali',
    description: 'Lapangan outdoor dekat pantai Canggu. Sesi sunset favorit setiap sore.',
    phone: '+62 361 555 0987', instagram: '@aldefpadel.bali', color: '0xc2410c', initials: 'AB', withTv: true,
    courts: [
      { name: 'Court Sunset', streamPath: 'court-demo-bali-1' },
      { name: 'Court Ocean', streamPath: 'court-demo-bali-2' },
    ],
  });
  const bandung = await createClub({
    name: 'Aldef Padel Bandung', slug: 'aldef-padel-bandung', city: 'Bandung', address: 'Jl. Dago Atas No. 88, Bandung',
    description: 'Sedang renovasi, dibuka kembali bulan depan.', phone: '+62 22 555 4411', instagram: '@aldefpadel.bdg',
    color: '0x4338ca', initials: 'BD', isActive: false,
    courts: [
      { name: 'Lapangan A', streamPath: 'court-demo-bdg-1', active: false },
      { name: 'Lapangan B', streamPath: 'court-demo-bdg-2', active: false },
    ],
  });

  await createAdmin(arena.club, 'admin.arena', 'Rina Kartika');
  await createAdmin(arena.club, 'kasir.arena', 'Yoga Pranata');
  await createAdmin(bali.club, 'admin.bali', 'Made Wirawan');
  await createAdmin(bandung.club, 'admin.bandung', 'Dedi Kurniawan');

  const players = await createPlayers(40);
  const arenaMembers = players.slice(0, 28);
  const baliMembers = [...players.slice(24, 40), ...players.slice(0, 3)];
  const bandungMembers = players.slice(30, 36);
  const member = (club: Club, users: User[]) =>
    prisma.clubMember.createMany({
      data: users.map((u) => ({ clubId: club.id, userId: u.id, createdAt: u.createdAt })),
    });
  await member(arena.club, arenaMembers);
  await member(bali.club, baliMembers);
  await member(bandung.club, bandungMembers);
  await prisma.clubMember.update({
    where: { clubId_userId: { clubId: arena.club.id, userId: arenaMembers[27].id } },
    data: { isBlocked: true, note: 'Dua kali tidak membayar sewa lapangan.' },
  });
  for (const [i, note] of ['Member bulanan, suka main jam 7 pagi.', 'Pelatih tamu setiap Sabtu.', 'Minta invoice perusahaan.'].entries())
    await prisma.clubMember.update({
      where: { clubId_userId: { clubId: arena.club.id, userId: arenaMembers[i * 5].id } },
      data: { note },
    });

  const active = (users: User[]) => users.filter((_, i) => i !== 27);
  await createHistory(samples, arena, active(arenaMembers), 0.62, 2);
  await createHistory(samples, bali, baliMembers, 0.4, 0);

  await createTournaments(arena, active(arenaMembers), demo, 'main');
  await createTournaments(bali, baliMembers, demo, 'bali');

  console.log(
    `demo-reset selesai dalam ${((Date.now() - started) / 1000).toFixed(1)} dtk: ` +
      `3 klub, ${players.length} pemain, ${sessionCount} sesi, ${clipCount} klip, 5 turnamen`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
