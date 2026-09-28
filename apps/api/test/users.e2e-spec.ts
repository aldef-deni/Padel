import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Menu Pengguna (SUPER_ADMIN). Semua data uji memakai penanda `run`.
describe('Users CRUD (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const digits = String(Math.floor(1e7 + Math.random() * 9e7));
  const password = 'rahasia-e2e-123';
  let clubId: string;
  let actorId: string;
  let superToken: string;
  let clubAdminToken: string;

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = (id: string, pw = password) =>
    request(server())
      .post('/api/auth/admin/login')
      .send({ login: id, password: pw });

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    clubId = (
      await prisma.club.create({
        data: { name: `Klub ${run}`, slug: `e2e-users-${run}` },
      })
    ).id;
    const passwordHash = await hashPassword(password);
    const actor = await prisma.user.create({
      data: { username: `actor-${run}`, passwordHash, role: Role.SUPER_ADMIN },
    });
    actorId = actor.id;
    await prisma.user.create({
      data: {
        username: `ca-${run}`,
        passwordHash,
        role: Role.CLUB_ADMIN,
        clubId,
      },
    });
    superToken = (await login(`actor-${run}`).expect(200)).body.accessToken;
    clubAdminToken = (await login(`ca-${run}`).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    const mine = {
      OR: [
        { username: { contains: run } },
        { email: { contains: run } },
        { phone: { contains: digits } },
      ],
    };
    await prisma.session.deleteMany({ where: { court: { clubId } } });
    await prisma.camera.deleteMany({ where: { court: { clubId } } });
    await prisma.court.deleteMany({ where: { clubId } });
    await prisma.user.deleteMany({ where: mine });
    await prisma.club.delete({ where: { id: clubId } });
    await app.close();
  });

  it('is SUPER_ADMIN only', async () => {
    await request(server()).get('/api/users').expect(401);
    await request(server())
      .get('/api/users')
      .set(auth(clubAdminToken))
      .expect(403);
    await request(server())
      .post('/api/users')
      .set(auth(clubAdminToken))
      .send({ role: 'PLAYER', phone: `0813${digits}` })
      .expect(403);
  });

  it('creates users per role with role-specific rules', async () => {
    const post = (body: object) =>
      request(server()).post('/api/users').set(auth(superToken)).send(body);

    // Admins: username/email + password.
    await post({ role: 'SUPER_ADMIN', username: `sa-${run}` }).expect(400); // no password
    await post({ role: 'SUPER_ADMIN', password }).expect(400); // no username/email
    await post({
      role: 'SUPER_ADMIN',
      username: `sa-${run}`,
      password: 'pendek',
    }).expect(400);
    const sa = (
      await post({
        role: 'SUPER_ADMIN',
        username: `SA-${run}`,
        name: ' Super Dua ',
        password,
      }).expect(201)
    ).body;
    expect(sa).toMatchObject({
      username: `sa-${run}`,
      name: 'Super Dua',
      role: 'SUPER_ADMIN',
      club: null,
      isActive: true,
      hasPassword: true,
      lastLoginAt: null,
    });
    expect(sa).not.toHaveProperty('passwordHash');
    await post({ role: 'SUPER_ADMIN', username: `sa-${run}`, password }).expect(
      409,
    ); // duplicate

    // Club admin: needs an existing club.
    await post({
      role: 'CLUB_ADMIN',
      email: `club-${run}@e2e.test`,
      password,
    }).expect(400);
    await post({
      role: 'CLUB_ADMIN',
      email: `club-${run}@e2e.test`,
      password,
      clubId: 'nope',
    }).expect(400);
    const ca = (
      await post({
        role: 'CLUB_ADMIN',
        email: `Club-${run}@E2E.test`,
        password,
        clubId,
      }).expect(201)
    ).body;
    expect(ca).toMatchObject({
      email: `club-${run}@e2e.test`,
      club: { id: clubId, name: `Klub ${run}` },
    });
    const caLogin = await login(`club-${run}@e2e.test`).expect(200);
    expect(caLogin.body.user.clubId).toBe(clubId);

    // Player: phone (OTP), no password.
    await post({ role: 'PLAYER', name: 'Tanpa HP' }).expect(400);
    await post({ role: 'PLAYER', phone: `0811${digits}`, password }).expect(
      400,
    );
    await post({ role: 'PLAYER', phone: '12' }).expect(400);
    const player = (
      await post({
        role: 'PLAYER',
        phone: `0811${digits}`,
        name: 'Pemain',
      }).expect(201)
    ).body;
    expect(player).toMatchObject({
      phone: `+62811${digits}`,
      hasPassword: false,
      club: null,
    });
  });

  it('lists with search, role filter, counts and pagination', async () => {
    const res = await request(server())
      .get(`/api/users?search=${run}`)
      .set(auth(superToken))
      .expect(200);
    // actor, ca, sa, club admin (email) — players have no `run` in their fields.
    expect(res.body.counts).toEqual({
      ALL: 4,
      SUPER_ADMIN: 2,
      CLUB_ADMIN: 2,
      PLAYER: 0,
    });
    expect(res.body.items.map((u: { role: string }) => u.role)).toEqual([
      'SUPER_ADMIN',
      'SUPER_ADMIN',
      'CLUB_ADMIN',
      'CLUB_ADMIN',
    ]);

    const filtered = await request(server())
      .get(`/api/users?search=${run}&role=CLUB_ADMIN&pageSize=1&page=2`)
      .set(auth(superToken))
      .expect(200);
    expect(filtered.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.counts.ALL).toBe(4); // counts ignore the role filter

    const byPhone = await request(server())
      .get(`/api/users?search=811${digits}`)
      .set(auth(superToken))
      .expect(200);
    expect(byPhone.body.items.map((u: { phone: string }) => u.phone)).toEqual([
      `+62811${digits}`,
    ]);

    await request(server())
      .get('/api/users?pageSize=500')
      .set(auth(superToken))
      .expect(400);
    await request(server())
      .get('/api/users?role=KING')
      .set(auth(superToken))
      .expect(400);
  });

  it('updates role/club, resets password and (de)activates accounts', async () => {
    const find = async (username: string) =>
      (await prisma.user.findUniqueOrThrow({ where: { username } })).id;
    const patch = (id: string, body: object) =>
      request(server())
        .patch(`/api/users/${id}`)
        .set(auth(superToken))
        .send(body);

    const saId = await find(`sa-${run}`);
    const oldToken = (await login(`sa-${run}`).expect(200)).body.accessToken;

    // Demote to club admin: needs a club; promote back clears it.
    await patch(saId, { role: 'CLUB_ADMIN' }).expect(400);
    const demoted = (
      await patch(saId, { role: 'CLUB_ADMIN', clubId }).expect(200)
    ).body;
    expect(demoted).toMatchObject({ role: 'CLUB_ADMIN', club: { id: clubId } });
    const promoted = (
      await patch(saId, { role: 'SUPER_ADMIN', clubId }).expect(200)
    ).body;
    expect(promoted).toMatchObject({
      role: 'SUPER_ADMIN',
      clubId: null,
      club: null,
    });

    // Reset password: old token revoked, new password works.
    await patch(saId, { password: 'password-baru-e2e-99' }).expect(200);
    await request(server()).get('/api/auth/me').set(auth(oldToken)).expect(401);
    await login(`sa-${run}`).expect(401);
    const fresh = (await login(`sa-${run}`, 'password-baru-e2e-99').expect(200))
      .body;
    expect(fresh.user.id).toBe(saId);

    // Deactivate: login refused and live tokens rejected; reactivate restores access.
    await patch(saId, { isActive: false }).expect(200);
    await login(`sa-${run}`, 'password-baru-e2e-99').expect(403);
    await request(server())
      .get('/api/auth/me')
      .set(auth(fresh.accessToken))
      .expect(401);
    await patch(saId, { isActive: true }).expect(200);
    await login(`sa-${run}`, 'password-baru-e2e-99').expect(200);
    const detail = await request(server())
      .get(`/api/users/${saId}`)
      .set(auth(superToken))
      .expect(200);
    expect(detail.body.lastLoginAt).not.toBeNull();

    // Clearing the only identifier of an admin is not allowed; null clears optional fields.
    await patch(saId, { username: null }).expect(400);
    const renamed = (
      await patch(saId, { name: null, email: `sa-${run}@e2e.test` }).expect(200)
    ).body;
    expect(renamed).toMatchObject({ name: null, email: `sa-${run}@e2e.test` });

    // Player -> admin needs a password; admin -> player drops it.
    const playerId = (
      await prisma.user.findUniqueOrThrow({
        where: { phone: `+62811${digits}` },
      })
    ).id;
    await patch(playerId, {
      role: 'SUPER_ADMIN',
      username: `pl-${run}`,
    }).expect(400);
    await patch(saId, { role: 'PLAYER' }).expect(400); // no phone
    const player = (
      await patch(saId, { role: 'PLAYER', phone: `0812${digits}` }).expect(200)
    ).body;
    expect(player).toMatchObject({ role: 'PLAYER', hasPassword: false });

    await patch('does-not-exist', { name: 'x' }).expect(404);
  });

  it('protects the signed-in super admin from locking themselves out', async () => {
    const patch = (body: object) =>
      request(server())
        .patch(`/api/users/${actorId}`)
        .set(auth(superToken))
        .send(body);
    await patch({ role: 'CLUB_ADMIN', clubId }).expect(400);
    await patch({ isActive: false }).expect(400);
    await request(server())
      .delete(`/api/users/${actorId}`)
      .set(auth(superToken))
      .expect(400);
    await patch({ name: 'Aktor' }).expect(200); // other edits are fine
  });

  it('deletes users, but not users with replay clips', async () => {
    const player = await prisma.user.findUniqueOrThrow({
      where: { phone: `+62811${digits}` },
    });
    const court = await prisma.court.create({
      data: {
        clubId,
        name: 'Lapangan',
        cameras: { create: { name: 'Cam', streamPath: `court-u-${run}` } },
      },
      include: { cameras: true },
    });
    await prisma.session.create({
      data: {
        courtId: court.id,
        qrToken: `qr-${run}`,
        clips: {
          create: {
            cameraId: court.cameras[0].id,
            requestedById: player.id,
            startAt: new Date(),
            durationSec: 30,
          },
        },
      },
    });

    const blocked = await request(server())
      .delete(`/api/users/${player.id}`)
      .set(auth(superToken))
      .expect(409);
    expect(blocked.body.message).toMatch(/deactivate/);

    const ca = await prisma.user.findUniqueOrThrow({
      where: { email: `club-${run}@e2e.test` },
    });
    await request(server())
      .delete(`/api/users/${ca.id}`)
      .set(auth(superToken))
      .expect(204);
    await request(server())
      .get(`/api/users/${ca.id}`)
      .set(auth(superToken))
      .expect(404);
  });
});
