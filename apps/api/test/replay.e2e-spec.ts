import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Clip } from '@padel/shared';
import { parse } from 'dotenv';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { ClipStorage } from '../src/clips/clip-storage.service.js';
import { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Alur replay end-to-end. Membutuhkan infra/ (Postgres, Redis, MediaMTX) dan ffmpeg:
// test ini mem-publish stream uji sendiri ke path court-e2e-<run>.
describe('Sessions & replay (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let ffmpeg: ChildProcess | undefined;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const phoneSuffix = String(Math.floor(1e7 + Math.random() * 9e7));
  const streamPath = `court-e2e-${run}`;
  const offlinePath = `court-e2e-off-${run}`;

  let clubId: string;
  let otherClubId: string;
  let courtId: string;
  let offlineCourtId: string;
  let adminToken: string;
  let otherAdminToken: string;
  let playerToken: string;
  let outsiderToken: string;
  const sockets: Socket[] = [];

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1'); // Socket.IO needs a real port.
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    const [club, other] = await Promise.all([
      prisma.club.create({
        data: { name: 'E2E Replay', slug: `e2e-replay-${run}` },
      }),
      prisma.club.create({
        data: { name: 'E2E Replay Other', slug: `e2e-replay-o-${run}` },
      }),
    ]);
    clubId = club.id;
    otherClubId = other.id;
    const court = await prisma.court.create({
      data: {
        clubId,
        name: 'Lapangan Replay',
        cameras: { create: { name: 'Cam', streamPath } },
      },
    });
    const offline = await prisma.court.create({
      data: {
        clubId,
        name: 'Lapangan Offline',
        cameras: { create: { name: 'Cam', streamPath: offlinePath } },
      },
    });
    courtId = court.id;
    offlineCourtId = offline.id;

    const passwordHash = await hashPassword('rahasia-e2e-123');
    const [admin, otherAdmin, player, outsider] = await Promise.all([
      prisma.user.create({
        data: {
          email: `rp-admin-${run}@e2e.test`,
          passwordHash,
          role: Role.CLUB_ADMIN,
          clubId,
        },
      }),
      prisma.user.create({
        data: {
          email: `rp-other-${run}@e2e.test`,
          passwordHash,
          role: Role.CLUB_ADMIN,
          clubId: otherClubId,
        },
      }),
      prisma.user.create({
        data: { phone: `+62811${phoneSuffix}`, role: Role.PLAYER },
      }),
      prisma.user.create({
        data: { phone: `+62812${phoneSuffix}`, role: Role.PLAYER },
      }),
    ]);
    const sign = (u: { id: string; role: Role }) =>
      jwt.signAsync({ sub: u.id, role: u.role });
    [adminToken, otherAdminToken, playerToken, outsiderToken] =
      await Promise.all([admin, otherAdmin, player, outsider].map(sign));

    ffmpeg = startTestStream(streamPath);
  });

  afterAll(async () => {
    ffmpeg?.kill('SIGINT');
    sockets.forEach((s) => s.disconnect());
    const clips = await prisma.clip.findMany({
      where: { session: { court: { clubId } } },
      select: { id: true },
    });
    const storage = app.get(ClipStorage);
    await Promise.all(clips.map((c) => storage.remove(c.id)));
    await prisma.session.deleteMany({ where: { court: { clubId } } }); // clips + players cascade
    await prisma.camera.deleteMany({ where: { court: { clubId } } });
    await prisma.court.deleteMany({ where: { clubId } });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { endsWith: `-${run}@e2e.test` } },
          { phone: `+62811${phoneSuffix}` },
          { phone: `+62812${phoneSuffix}` },
        ],
      },
    });
    await prisma.club.deleteMany({
      where: { id: { in: [clubId, otherClubId] } },
    });
    await app.close();
  });

  /** Connects with a JWT (string) or TV credentials ({ clubId, tvKey }). */
  function connect(
    credentials?: string | { clubId: string; tvKey: string },
  ): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(baseUrl, {
        auth:
          typeof credentials === 'string'
            ? { token: credentials }
            : (credentials ?? {}),
        transports: ['websocket'],
      });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  function waitForClip(
    socket: Socket,
    clipId: string,
    status: Clip['status'],
  ): Promise<Clip> {
    return new Promise((resolve) => {
      socket.on('clip:updated', (clip: Clip) => {
        if (clip.id === clipId && clip.status === status) resolve(clip);
      });
    });
  }

  it('full replay flow: session, QR, join, replay, socket notification, download', async () => {
    // Admin starts a session; only one active session per court.
    const session = (
      await request(server())
        .post(`/api/courts/${courtId}/sessions`)
        .set(auth(adminToken))
        .expect(201)
    ).body;
    expect(session).toMatchObject({ courtId, endedAt: null, playerCount: 0 });
    await request(server())
      .post(`/api/courts/${courtId}/sessions`)
      .set(auth(adminToken))
      .expect(409);
    await request(server())
      .post(`/api/courts/${courtId}/sessions`)
      .set(auth(otherAdminToken))
      .expect(403);
    const active = await request(server())
      .get(`/api/courts/${courtId}/sessions/active`)
      .set(auth(adminToken))
      .expect(200);
    expect(active.body.session.id).toBe(session.id);

    const qr = await request(server())
      .get(`/api/sessions/${session.id}/qr`)
      .set(auth(adminToken))
      .expect(200);
    expect(qr.body.joinUrl).toMatch(new RegExp(`/join/${session.qrToken}$`));
    expect(qr.body.svg).toMatch(/^<svg/);

    // Player scans the QR.
    await request(server())
      .get(`/api/sessions/${session.id}`)
      .set(auth(playerToken))
      .expect(403);
    await request(server())
      .post('/api/sessions/join')
      .set(auth(playerToken))
      .send({ qrToken: 'tidak-ada-token-ini' })
      .expect(404);
    await request(server())
      .post('/api/sessions/join')
      .set(auth(adminToken))
      .send({ qrToken: session.qrToken })
      .expect(403); // join is for players
    const joined = await request(server())
      .post('/api/sessions/join')
      .set(auth(playerToken))
      .send({ qrToken: session.qrToken })
      .expect(200);
    expect(joined.body).toMatchObject({
      session: { id: session.id, playerCount: 1 },
      court: { id: courtId, name: 'Lapangan Replay' },
      club: { id: clubId },
    });

    // Realtime: authenticated socket subscribed to the session.
    await expect(connect()).rejects.toThrow('Unauthorized');
    const socket = await connect(playerToken);
    expect(
      await socket.emitWithAck('session:subscribe', { sessionId: session.id }),
    ).toEqual({
      ok: true,
    });
    const outsider = await connect(outsiderToken);
    expect(
      await outsider.emitWithAck('session:subscribe', {
        sessionId: session.id,
      }),
    ).toMatchObject({ ok: false });

    // The club's TV screen (TV link key, no user) gets every clip of the club.
    const link = await request(server())
      .post(`/api/clubs/${clubId}/tv-link`)
      .set(auth(adminToken))
      .expect(200);
    const tvKey = new URL(link.body.url).searchParams.get('key')!;
    expect(link.body.url).toContain(`/tv/${clubId}?key=`);
    const tv = await connect({ clubId, tvKey });
    expect(
      await tv.emitWithAck('session:subscribe', { sessionId: session.id }),
    ).toEqual({ ok: false, error: 'Unauthorized' }); // TV can't use session rooms

    // Let the test stream record a few seconds, then press replay.
    await waitForRecording(streamPath, 7);
    await request(server())
      .post(`/api/sessions/${session.id}/replays`)
      .set(auth(outsiderToken))
      .send({})
      .expect(403);
    await request(server())
      .post(`/api/sessions/${session.id}/replays`)
      .set(auth(playerToken))
      .send({ durationSec: 2 })
      .expect(400);
    const replay = await request(server())
      .post(`/api/sessions/${session.id}/replays`)
      .set(auth(playerToken))
      .send({ durationSec: 5 })
      .expect(202);
    expect(replay.body).toHaveLength(1);
    expect(replay.body[0]).toMatchObject({
      status: 'PENDING',
      durationSec: 5,
      downloadUrl: null,
    });

    const tvReady = waitForClip(tv, replay.body[0].id, 'READY');
    const ready = await waitForClip(socket, replay.body[0].id, 'READY');
    expect((await tvReady).downloadUrl).toBeTruthy();
    expect(ready.downloadUrl).toMatch(/^\/api\/clips\/.+\/file\?exp=\d+&sig=/);

    const file = await request(server()).get(ready.downloadUrl!).expect(200);
    expect(file.headers['content-type']).toBe('video/mp4');
    expect(Number(file.headers['content-length'])).toBeGreaterThan(10_000);
    await request(server())
      .get(ready.downloadUrl!.replace(/sig=.*/, 'sig=salah'))
      .expect(403);

    const clips = await request(server())
      .get(`/api/sessions/${session.id}/clips`)
      .set(auth(playerToken))
      .expect(200);
    expect(clips.body.map((c: Clip) => [c.id, c.status])).toEqual([
      [ready.id, 'READY'],
    ]);

    const snapshot = await request(server())
      .get(`/api/tv/${clubId}?key=${tvKey}`)
      .expect(200);
    expect(snapshot.body.club).toMatchObject({
      id: clubId,
      name: 'E2E Replay',
    });
    expect(snapshot.body.cameras).toHaveLength(2);
    expect(snapshot.body.recentClips.map((c: Clip) => c.id)).toEqual([
      ready.id,
    ]);

    // Dashboard overview for the club.
    const overview = await request(server())
      .get(`/api/clubs/${clubId}/overview`)
      .set(auth(adminToken))
      .expect(200);
    expect(overview.body.activeSessions).toEqual([
      expect.objectContaining({
        sessionId: session.id,
        courtId,
        playerCount: 1,
      }),
    ]);
    expect(overview.body.clipsToday).toEqual({ total: 1, ready: 1, failed: 0 });
    expect(overview.body.recentClips[0]).toMatchObject({
      id: ready.id,
      status: 'READY',
      courtId,
      courtName: 'Lapangan Replay',
      cameraName: 'Cam',
    });
    await request(server())
      .get(`/api/clubs/${clubId}/overview`)
      .set(auth(otherAdminToken))
      .expect(403);

    // Ending the session closes it for joins and replays.
    await request(server())
      .post(`/api/sessions/${session.id}/end`)
      .set(auth(adminToken))
      .expect(200);
    await request(server())
      .post('/api/sessions/join')
      .set(auth(outsiderToken))
      .send({ qrToken: session.qrToken })
      .expect(410);
    await request(server())
      .post(`/api/sessions/${session.id}/replays`)
      .set(auth(playerToken))
      .send({})
      .expect(409);
  }, 60_000);

  it('marks the clip FAILED when the camera has no recording', async () => {
    const session = (
      await request(server())
        .post(`/api/courts/${offlineCourtId}/sessions`)
        .set(auth(adminToken))
        .expect(201)
    ).body;
    const socket = await connect(adminToken);
    await socket.emitWithAck('session:subscribe', { sessionId: session.id });

    const replay = await request(server())
      .post(`/api/sessions/${session.id}/replays`)
      .set(auth(adminToken))
      .send({})
      .expect(202);
    expect(replay.body[0].durationSec).toBe(30); // default
    const failed = await waitForClip(socket, replay.body[0].id, 'FAILED');
    expect(failed.error).toMatch(/No recording for this time range/);
  }, 30_000);

  it('replay library: sizes, stats, filters, club scope, delete; recording status', async () => {
    // Player app history: the session joined in the first test, with its clip counts.
    const mine = await request(server())
      .get('/api/me/sessions')
      .set(auth(playerToken))
      .expect(200);
    expect(mine.body).toEqual([
      expect.objectContaining({
        court: { id: courtId, name: 'Lapangan Replay' },
        club: { id: clubId, name: 'E2E Replay', logoUrl: null },
        clips: { total: 1, ready: 1 },
        lastClipAt: expect.any(String),
      }),
    ]);
    expect(mine.body[0].session.endedAt).toEqual(expect.any(String));
    await request(server()).get('/api/me/sessions').set(auth(adminToken)).expect(403);

    const lib = await request(server())
      .get(`/api/clips?clubId=${clubId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(lib.body.stats).toMatchObject({
      total: 2,
      ready: 1,
      failed: 1,
      inProgress: 0,
      today: 2,
    });
    const ready = lib.body.items.find((c: Clip) => c.status === 'READY');
    expect(ready).toMatchObject({
      court: { id: courtId, name: 'Lapangan Replay' },
      camera: { name: 'Cam' },
      requestedBy: { id: expect.any(String) },
      session: { id: expect.any(String) },
    });
    expect(ready.sizeBytes).toBeGreaterThan(10_000);
    expect(lib.body.stats.storageBytes).toBe(ready.sizeBytes);
    expect(ready.downloadUrl).toMatch(/^\/api\/clips\/.+\/file\?/);

    const list = async (query: string, token = adminToken) =>
      (
        await request(server())
          .get(`/api/clips?clubId=${clubId}&${query}`)
          .set(auth(token))
          .expect(200)
      ).body;
    expect((await list('status=FAILED')).items.map((c: Clip) => c.status)).toEqual(['FAILED']);
    expect((await list(`courtId=${offlineCourtId}`)).total).toBe(1);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
      new Date(Date.now() + 86_400_000),
    );
    expect((await list(`from=${today}&to=${today}`)).total).toBe(2);
    expect((await list(`from=${tomorrow}`)).total).toBe(0);
    await request(server())
      .get('/api/clips?from=kemarin')
      .set(auth(adminToken))
      .expect(400);

    // Other club's admin: scoped to their own club; players have no access.
    await request(server())
      .get(`/api/clips?clubId=${clubId}`)
      .set(auth(otherAdminToken))
      .expect(403);
    const own = await request(server())
      .get('/api/clips')
      .set(auth(otherAdminToken))
      .expect(200);
    expect(own.body.total).toBe(0);
    await request(server()).get('/api/clips').set(auth(playerToken)).expect(403);

    // Recording status comes from MediaMTX segments.
    const status = await request(server())
      .get(`/api/cameras/status?clubId=${clubId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(status.body.recordRetentionHours).toBe(2);
    const byPath = new Map(
      status.body.cameras.map((c: { streamPath: string }) => [c.streamPath, c]),
    );
    expect(byPath.get(streamPath)).toMatchObject({
      recording: { active: true, availableFrom: expect.any(String) },
    });
    expect(
      (byPath.get(streamPath) as { recording: { segments: number } }).recording.segments,
    ).toBeGreaterThan(0);
    expect(byPath.get(offlinePath)).toMatchObject({
      recording: { active: false, availableFrom: null, segments: 0 },
    });

    // Delete: removes the row and the file.
    await request(server())
      .delete(`/api/clips/${ready.id}`)
      .set(auth(otherAdminToken))
      .expect(403);
    await request(server())
      .delete(`/api/clips/${ready.id}`)
      .set(auth(adminToken))
      .expect(204);
    expect(await app.get(ClipStorage).size(ready.id)).toBeNull();
    expect((await list('')).stats).toMatchObject({ total: 1, storageBytes: 0 });
    await request(server())
      .delete(`/api/clips/${ready.id}`)
      .set(auth(adminToken))
      .expect(404);

    // Not a demo instance: no demo account advertised.
    const config = await request(server()).get('/api/public/config').expect(200);
    expect(config.body).toEqual({ demo: null });
  });

  it('TV link: rotate invalidates the old key; other clubs cannot read it', async () => {
    await request(server())
      .get(`/api/clubs/${clubId}/tv-link`)
      .set(auth(otherAdminToken))
      .expect(403);
    await request(server())
      .post(`/api/clubs/${clubId}/tv-link`)
      .set(auth(playerToken))
      .expect(403);

    const first = await request(server())
      .post(`/api/clubs/${clubId}/tv-link`)
      .set(auth(adminToken))
      .expect(200);
    const oldKey = new URL(first.body.url).searchParams.get('key')!;
    const oldTv = await connect({ clubId, tvKey: oldKey });
    const kicked = new Promise<string>((resolve) =>
      oldTv.on('disconnect', resolve),
    );
    const current = await request(server())
      .get(`/api/clubs/${clubId}/tv-link`)
      .set(auth(adminToken))
      .expect(200);
    expect(current.body.url).toBe(first.body.url);

    const second = await request(server())
      .post(`/api/clubs/${clubId}/tv-link`)
      .set(auth(adminToken))
      .expect(200);
    const newKey = new URL(second.body.url).searchParams.get('key')!;
    expect(newKey).not.toBe(oldKey);
    // TVs still connected with the old key are cut off immediately.
    expect(await kicked).toBe('io server disconnect');

    await request(server()).get(`/api/tv/${clubId}?key=${oldKey}`).expect(401);
    await request(server()).get(`/api/tv/${clubId}`).expect(401);
    await request(server())
      .get(`/api/tv/${otherClubId}?key=${newKey}`)
      .expect(401);
    await request(server()).get(`/api/tv/${clubId}?key=${newKey}`).expect(200);
    await expect(connect({ clubId, tvKey: oldKey })).rejects.toThrow(
      'Unauthorized',
    );
  });

  it('club logo: upload PNG, public download, rejects non-images', async () => {
    // 1x1 transparent PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    await request(server())
      .post(`/api/clubs/${clubId}/logo`)
      .set(auth(adminToken))
      .attach('file', Buffer.from('<svg onload="alert(1)"/>'), 'logo.svg')
      .expect(400);
    await request(server())
      .post(`/api/clubs/${clubId}/logo`)
      .set(auth(otherAdminToken))
      .attach('file', png, 'logo.png')
      .expect(403);
    await request(server())
      .post(`/api/clubs/${clubId}/logo`)
      .set(auth(adminToken))
      .attach('file', Buffer.alloc(1024 * 1024 + 1), 'big.png')
      .expect(413);

    const club = await request(server())
      .post(`/api/clubs/${clubId}/logo`)
      .set(auth(adminToken))
      .attach('file', png, 'logo.png')
      .expect(201);
    expect(club.body.logoUrl).toMatch(
      new RegExp(`^/api/clubs/${clubId}/logo\\?v=`),
    );
    expect(club.body).not.toHaveProperty('tvKey');

    const logo = await request(server()).get(club.body.logoUrl).expect(200); // no token
    expect(logo.headers['content-type']).toBe('image/png');
    expect(Buffer.from(logo.body)).toEqual(png);

    await request(server())
      .delete(`/api/clubs/${clubId}/logo`)
      .set(auth(adminToken))
      .expect(204);
    await request(server()).get(`/api/clubs/${clubId}/logo`).expect(404);
  });
});

/** Publishes a small H.264 test stream with the camera credentials from infra/.env. */
function startTestStream(path: string): ChildProcess {
  const env = parse(
    readFileSync(new URL('../../../infra/.env', import.meta.url)),
  );
  const url = `rtmp://127.0.0.1:1935/${path}?user=${env.CAMERA_USER}&pass=${env.CAMERA_PASS}`;
  // prettier-ignore
  const args = [
    '-hide_banner', '-loglevel', 'error', '-re',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25', '-t', '45',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-bf', '0', '-g', '25',
    '-f', 'flv', url,
  ];
  return spawn('ffmpeg', args, { stdio: 'ignore' });
}

/** Waits until MediaMTX has been receiving the path for at least `seconds`. */
async function waitForRecording(path: string, seconds: number) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const res = await fetch(`http://127.0.0.1:9997/v3/paths/get/${path}`);
    if (res.ok) {
      const body = (await res.json()) as {
        online?: boolean;
        onlineTime?: string;
      };
      if (body.online && body.onlineTime) {
        const wait =
          new Date(body.onlineTime).getTime() + seconds * 1000 - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Stream ${path} never came online`);
}
