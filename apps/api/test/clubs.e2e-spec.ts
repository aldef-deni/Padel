import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Menu Klub (SUPER_ADMIN) + efek klub nonaktif. Semua data uji memakai penanda `run`.
describe('Clubs management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const password = 'rahasia-e2e-123';
  const playerPhone = `+62819${Math.floor(1e7 + Math.random() * 9e7)}`;
  let superToken: string;
  let clubAdminToken: string;
  let clubId: string;

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = (id: string) =>
    request(server())
      .post('/api/auth/admin/login')
      .send({ login: id, password });

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);
    await prisma.user.create({
      data: { username: `csa-${run}`, passwordHash, role: Role.SUPER_ADMIN },
    });
    superToken = (await login(`csa-${run}`).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    const clubs = { slug: { startsWith: `e2e-club-${run}` } };
    await prisma.session.deleteMany({ where: { court: { club: clubs } } });
    await prisma.camera.deleteMany({ where: { court: { club: clubs } } });
    await prisma.court.deleteMany({ where: { club: clubs } });
    await prisma.user.deleteMany({
      where: {
        OR: [{ username: { contains: run } }, { phone: playerPhone }],
      },
    });
    await prisma.club.deleteMany({ where: clubs });
    await app.close();
  });

  it('creates a club with a full, normalized profile', async () => {
    const post = (body: object) =>
      request(server()).post('/api/clubs').set(auth(superToken)).send(body);
    const base = { name: 'Klub E2E', slug: `e2e-club-${run}` };

    await post({ ...base, openTime: '25:00' }).expect(400);
    await post({ ...base, website: 'padel.id' }).expect(400); // needs http(s)://
    await post({ ...base, phone: '12' }).expect(400);
    await post({ ...base, instagram: 'bad handle!' }).expect(400);

    const club = (
      await post({
        ...base,
        name: '  Klub E2E  ',
        address: 'Jl. Uji 1',
        city: 'Bandung',
        description: '',
        phone: '0812 3456 7890',
        email: 'Halo@Klub.ID',
        website: 'https://klub.example',
        instagram: 'https://www.instagram.com/klub.e2e/?hl=id',
        mapsUrl: 'https://maps.app.goo.gl/abc',
        openTime: '06:00',
        closeTime: '23:30',
        timezone: 'Asia/Makassar',
      }).expect(201)
    ).body;
    expect(club).toMatchObject({
      name: 'Klub E2E',
      city: 'Bandung',
      description: null,
      phone: '+6281234567890',
      email: 'halo@klub.id',
      instagram: 'klub.e2e',
      openTime: '06:00',
      closeTime: '23:30',
      timezone: 'Asia/Makassar',
      isActive: true,
    });
    expect(club).not.toHaveProperty('tvKey');
    clubId = club.id;
    await post(base).expect(409); // slug taken

    // Club admin + a court with a camera for the stats and the deactivation checks.
    await prisma.user.create({
      data: {
        username: `cadm-${run}`,
        passwordHash: await hashPassword(password),
        role: Role.CLUB_ADMIN,
        clubId,
      },
    });
    await prisma.court.create({
      data: {
        clubId,
        name: 'Lapangan',
        cameras: { create: { name: 'Cam', streamPath: `court-c-${run}` } },
      },
    });
    clubAdminToken = (await login(`cadm-${run}`).expect(200)).body.accessToken;
  });

  it('lists clubs with stats for super admins only', async () => {
    await request(server())
      .get('/api/clubs/stats')
      .set(auth(clubAdminToken))
      .expect(403);
    const res = await request(server())
      .get(`/api/clubs/stats?search=${run}`)
      .set(auth(superToken))
      .expect(200);
    expect(res.body.counts).toEqual({ ALL: 1, ACTIVE: 1, INACTIVE: 0 });
    expect(res.body.items[0]).toMatchObject({
      id: clubId,
      stats: {
        courts: 1,
        cameras: 1,
        admins: 1,
        activeSessions: 0,
        clips30d: 0,
      },
    });
    const inactive = await request(server())
      .get(`/api/clubs/stats?search=${run}&status=INACTIVE`)
      .set(auth(superToken))
      .expect(200);
    expect(inactive.body.items).toEqual([]);

    const admins = await request(server())
      .get(`/api/users?clubId=${clubId}`)
      .set(auth(superToken))
      .expect(200);
    expect(
      admins.body.items.map((u: { username: string }) => u.username),
    ).toEqual([`cadm-${run}`]);
  });

  it('lets a club admin edit the profile but not the status', async () => {
    const res = await request(server())
      .patch(`/api/clubs/${clubId}`)
      .set(auth(clubAdminToken))
      .send({ description: 'Klub padel terbaik', city: null })
      .expect(200);
    expect(res.body).toMatchObject({
      description: 'Klub padel terbaik',
      city: null,
    });
    await request(server())
      .patch(`/api/clubs/${clubId}`)
      .set(auth(clubAdminToken))
      .send({ isActive: false })
      .expect(403);
  });

  it('deactivating a club locks out its admins, sessions and TV screens', async () => {
    const court = await prisma.court.findFirstOrThrow({ where: { clubId } });
    const tv = (
      await request(server())
        .post(`/api/clubs/${clubId}/tv-link`)
        .set(auth(superToken))
        .expect(200)
    ).body;
    const tvKey = new URL(tv.url).searchParams.get('key')!;
    const session = (
      await request(server())
        .post(`/api/courts/${court.id}/sessions`)
        .set(auth(superToken))
        .expect(201)
    ).body;
    const player = await prisma.user.create({
      data: {
        phone: playerPhone,
        role: Role.PLAYER,
      },
    });
    const playerToken = await app
      .get(JwtService)
      .signAsync({ sub: player.id, role: player.role });

    await request(server())
      .patch(`/api/clubs/${clubId}`)
      .set(auth(superToken))
      .send({ isActive: false })
      .expect(200);

    await login(`cadm-${run}`).expect(403);
    await request(server())
      .get('/api/auth/me')
      .set(auth(clubAdminToken))
      .expect(401);
    await request(server()).get(`/api/tv/${clubId}?key=${tvKey}`).expect(401);
    await request(server())
      .post('/api/sessions/join')
      .set(auth(playerToken))
      .send({ qrToken: session.qrToken })
      .expect(403);
    await request(server())
      .post(`/api/sessions/${session.id}/replays`)
      .set(auth(superToken))
      .send({})
      .expect(403);
    await request(server())
      .post(`/api/sessions/${session.id}/end`)
      .set(auth(superToken))
      .expect(200);
    await request(server())
      .post(`/api/courts/${court.id}/sessions`)
      .set(auth(superToken))
      .expect(403);

    // Super admin still manages it; reactivating restores access.
    const listed = await request(server())
      .get(`/api/clubs/stats?search=${run}&status=INACTIVE`)
      .set(auth(superToken))
      .expect(200);
    expect(listed.body.items.map((c: { id: string }) => c.id)).toEqual([
      clubId,
    ]);
    await request(server())
      .patch(`/api/clubs/${clubId}`)
      .set(auth(superToken))
      .send({ isActive: true })
      .expect(200);
    await login(`cadm-${run}`).expect(200);
    await request(server()).get(`/api/tv/${clubId}?key=${tvKey}`).expect(200);
  });

  it('only deletes empty clubs', async () => {
    const blocked = await request(server())
      .delete(`/api/clubs/${clubId}`)
      .set(auth(superToken))
      .expect(409);
    expect(blocked.body.message).toMatch(/1 court\(s\) and 1 admin\(s\)/);
    await request(server())
      .delete(`/api/clubs/${clubId}`)
      .set(auth(clubAdminToken))
      .expect(403);

    const empty = (
      await request(server())
        .post('/api/clubs')
        .set(auth(superToken))
        .send({ name: 'Kosong', slug: `e2e-club-${run}-kosong` })
        .expect(201)
    ).body;
    await request(server())
      .delete(`/api/clubs/${empty.id}`)
      .set(auth(superToken))
      .expect(204);
    await request(server())
      .get(`/api/clubs/${empty.id}`)
      .set(auth(superToken))
      .expect(404);
  });
});
