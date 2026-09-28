import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { OTP_SENDER, type OtpSender } from '../src/auth/otp/otp-sender.js';
import { hashPassword } from '../src/auth/password.js';
import { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Membutuhkan PostgreSQL dari infra/ yang sudah dimigrasi (DATABASE_URL di .env).
// Semua data uji memakai suffix unik dan dibersihkan di afterAll.
describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const password = 'rahasia-e2e-123';
  const superEmail = `super-${run}@e2e.test`;
  const clubAdminEmail = `klub-${run}@e2e.test`;
  const phones = [randomPhone(), randomPhone()];

  // Captures OTP codes instead of logging them.
  const sentCodes = new Map<string, string>();
  const fakeSender: OtpSender = {
    send: async (phone, code) => {
      sentCodes.set(phone, code);
    },
  };

  let superToken: string;
  let clubAdminToken: string;
  let ownClubId: string;
  let otherClubId: string;

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OTP_SENDER)
      .useValue(fakeSender)
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const [own, other] = await Promise.all([
      prisma.club.create({ data: { name: 'E2E Own', slug: `e2e-own-${run}` } }),
      prisma.club.create({
        data: { name: 'E2E Other', slug: `e2e-other-${run}` },
      }),
    ]);
    ownClubId = own.id;
    otherClubId = other.id;

    const passwordHash = await hashPassword(password);
    await prisma.user.createMany({
      data: [
        { email: superEmail, passwordHash, role: Role.SUPER_ADMIN },
        {
          email: clubAdminEmail,
          passwordHash,
          role: Role.CLUB_ADMIN,
          clubId: ownClubId,
        },
      ],
    });

    superToken = await login(superEmail);
    clubAdminToken = await login(clubAdminEmail);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { endsWith: `-${run}@e2e.test` } },
          { phone: { in: phones } },
        ],
      },
    });
    await prisma.otpCode.deleteMany({ where: { phone: { in: phones } } });
    await prisma.camera.deleteMany({
      where: { court: { clubId: { in: [ownClubId, otherClubId] } } },
    });
    await prisma.court.deleteMany({
      where: { clubId: { in: [ownClubId, otherClubId] } },
    });
    await prisma.club.deleteMany({
      where: { id: { in: [ownClubId, otherClubId] } },
    });
    await app.close();
  });

  async function login(email: string) {
    const res = await request(server())
      .post('/api/auth/admin/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('GET /api/health is public', () =>
    request(server()).get('/api/health').expect(200, { status: 'ok' }));

  it('GET /docs-json exposes auth and CRUD routes with bearer auth', async () => {
    const res = await request(server()).get('/docs-json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/auth/admin/login',
        '/api/auth/otp/request',
        '/api/auth/otp/verify',
        '/api/clubs',
        '/api/courts/{id}',
        '/api/cameras',
      ]),
    );
    expect(res.body.components.securitySchemes).toHaveProperty('bearer');
  });

  describe('admin login', () => {
    it('rejects a wrong password and unknown email with the same 401', async () => {
      const wrong = await request(server())
        .post('/api/auth/admin/login')
        .send({ email: superEmail, password: 'salah' })
        .expect(401);
      const unknown = await request(server())
        .post('/api/auth/admin/login')
        .send({ email: `nobody-${run}@e2e.test`, password })
        .expect(401);
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('GET /api/auth/me returns the user without the password hash', async () => {
      const res = await request(server())
        .get('/api/auth/me')
        .set(auth(superToken))
        .expect(200);
      expect(res.body).toMatchObject({
        email: superEmail,
        role: 'SUPER_ADMIN',
      });
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('rejects missing or invalid tokens', async () => {
      await request(server()).get('/api/clubs').expect(401);
      await request(server())
        .get('/api/clubs')
        .set(auth('not-a-jwt'))
        .expect(401);
    });
  });

  describe('change password', () => {
    it('requires the current password and revokes older tokens', async () => {
      const email = `pw-${run}@e2e.test`;
      const newPassword = 'password-baru-e2e-456';
      await prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword(password),
          role: Role.SUPER_ADMIN,
        },
      });
      const oldToken = await login(email);

      await request(server())
        .patch('/api/auth/password')
        .set(auth(oldToken))
        .send({ currentPassword: 'salah', newPassword })
        .expect(401);
      await request(server())
        .patch('/api/auth/password')
        .set(auth(oldToken))
        .send({ currentPassword: password, newPassword: 'pendek' })
        .expect(400);
      await request(server())
        .patch('/api/auth/password')
        .set(auth(oldToken))
        .send({ currentPassword: password, newPassword: password })
        .expect(400);

      const res = await request(server())
        .patch('/api/auth/password')
        .set(auth(oldToken))
        .send({ currentPassword: password, newPassword })
        .expect(200);

      // Old token is revoked; the returned token works.
      await request(server())
        .get('/api/auth/me')
        .set(auth(oldToken))
        .expect(401);
      await request(server())
        .get('/api/auth/me')
        .set(auth(res.body.accessToken))
        .expect(200);

      await request(server())
        .post('/api/auth/admin/login')
        .send({ email, password })
        .expect(401);
      await request(server())
        .post('/api/auth/admin/login')
        .send({ email, password: newPassword })
        .expect(200);
    });
  });

  describe('player OTP login', () => {
    it('logs in a new player with a valid code', async () => {
      const local = `0${phones[0].slice(3)}`; // "+62812..." -> "0812..."
      const requested = await request(server())
        .post('/api/auth/otp/request')
        .send({ phone: local })
        .expect(202);
      expect(requested.body.phone).toBe(phones[0]);

      // Resend cooldown.
      await request(server())
        .post('/api/auth/otp/request')
        .send({ phone: phones[0] })
        .expect(429);

      const code = sentCodes.get(phones[0])!;
      const wrong = code === '000000' ? '111111' : '000000';
      await request(server())
        .post('/api/auth/otp/verify')
        .send({ phone: phones[0], code: wrong })
        .expect(401);

      const res = await request(server())
        .post('/api/auth/otp/verify')
        .send({ phone: local, code })
        .expect(200);
      expect(res.body.user).toMatchObject({ phone: phones[0], role: 'PLAYER' });

      // A code can be used only once.
      await request(server())
        .post('/api/auth/otp/verify')
        .send({ phone: phones[0], code })
        .expect(401);

      // Players cannot use admin CRUD or change a password.
      await request(server())
        .get('/api/clubs')
        .set(auth(res.body.accessToken))
        .expect(403);
      await request(server())
        .patch('/api/auth/password')
        .set(auth(res.body.accessToken))
        .send({ currentPassword: 'x', newPassword: 'password-panjang-123' })
        .expect(403);
      await request(server())
        .get('/api/auth/me')
        .set(auth(res.body.accessToken))
        .expect(200);
    });

    it('locks a code after 5 wrong attempts', async () => {
      await request(server())
        .post('/api/auth/otp/request')
        .send({ phone: phones[1] })
        .expect(202);
      const code = sentCodes.get(phones[1])!;
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i++) {
        await request(server())
          .post('/api/auth/otp/verify')
          .send({ phone: phones[1], code: wrong })
          .expect(401);
      }
      await request(server())
        .post('/api/auth/otp/verify')
        .send({ phone: phones[1], code })
        .expect(401);
    });

    it('rejects invalid phone numbers', () =>
      request(server())
        .post('/api/auth/otp/request')
        .send({ phone: '12' })
        .expect(400));
  });

  describe('super admin', () => {
    it('rejects invalid DTOs', async () => {
      await request(server())
        .post('/api/clubs')
        .set(auth(superToken))
        .send({ name: 'X', slug: 'Bad Slug' })
        .expect(400);
      await request(server())
        .post('/api/cameras')
        .set(auth(superToken))
        .send({ courtId: 'x', name: 'Cam', streamPath: 'lapangan-1' })
        .expect(400);
    });

    it('club -> court -> camera CRUD round trip', async () => {
      const slug = `e2e-crud-${run}`;
      const club = (
        await request(server())
          .post('/api/clubs')
          .set(auth(superToken))
          .send({ name: 'E2E Club', slug })
          .expect(201)
      ).body;
      await request(server())
        .post('/api/clubs')
        .set(auth(superToken))
        .send({ name: 'Dup', slug })
        .expect(409);

      const court = (
        await request(server())
          .post('/api/courts')
          .set(auth(superToken))
          .send({ clubId: club.id, name: 'Lapangan E2E' })
          .expect(201)
      ).body;
      const camera = (
        await request(server())
          .post('/api/cameras')
          .set(auth(superToken))
          .send({
            courtId: court.id,
            name: 'Kamera E2E',
            streamPath: `court-${slug}`,
          })
          .expect(201)
      ).body;

      await request(server())
        .patch(`/api/cameras/${camera.id}`)
        .set(auth(superToken))
        .send({ isActive: false })
        .expect(200)
        .expect((res) => expect(res.body.isActive).toBe(false));

      await request(server())
        .delete(`/api/courts/${court.id}`)
        .set(auth(superToken))
        .expect(409);
      await request(server())
        .delete(`/api/cameras/${camera.id}`)
        .set(auth(superToken))
        .expect(204);
      await request(server())
        .delete(`/api/courts/${court.id}`)
        .set(auth(superToken))
        .expect(204);
      await request(server())
        .delete(`/api/clubs/${club.id}`)
        .set(auth(superToken))
        .expect(204);
      await request(server())
        .get(`/api/clubs/${club.id}`)
        .set(auth(superToken))
        .expect(404);
    });
  });

  describe('camera status', () => {
    it('reports offline cameras from MediaMTX, scoped per club', async () => {
      const court = await prisma.court.create({
        data: { clubId: otherClubId, name: 'Lapangan Status' },
      });
      const camera = await prisma.camera.create({
        data: {
          courtId: court.id,
          name: 'Kamera Status',
          streamPath: `court-status-${run}`,
        },
      });

      const res = await request(server())
        .get(`/api/cameras/status?clubId=${otherClubId}`)
        .set(auth(superToken))
        .expect(200);
      expect(res.body.mediaServerReachable).toBe(true);
      expect(res.body.cameras).toEqual([
        {
          cameraId: camera.id,
          streamPath: camera.streamPath,
          online: false,
          onlineSince: null,
          tracks: [],
          video: null,
          bytesReceived: 0,
          readers: 0,
        },
      ]);

      // A club admin never sees another club's cameras.
      const own = await request(server())
        .get('/api/cameras/status')
        .set(auth(clubAdminToken))
        .expect(200);
      expect(
        own.body.cameras.map((c: { cameraId: string }) => c.cameraId),
      ).not.toContain(camera.id);
    });
  });

  describe('club admin', () => {
    it('only sees and manages their own club', async () => {
      const clubs = await request(server())
        .get('/api/clubs')
        .set(auth(clubAdminToken))
        .expect(200);
      expect(clubs.body.map((c: { id: string }) => c.id)).toEqual([ownClubId]);

      await request(server())
        .get(`/api/clubs/${otherClubId}`)
        .set(auth(clubAdminToken))
        .expect(403);
      await request(server())
        .patch(`/api/clubs/${otherClubId}`)
        .set(auth(clubAdminToken))
        .send({ name: 'Hacked' })
        .expect(403);
      await request(server())
        .patch(`/api/clubs/${ownClubId}`)
        .set(auth(clubAdminToken))
        .send({ address: 'Bandung' })
        .expect(200);

      // Creating and deleting clubs is SUPER_ADMIN only.
      await request(server())
        .post('/api/clubs')
        .set(auth(clubAdminToken))
        .send({ name: 'X', slug: `e2e-x-${run}` })
        .expect(403);
      await request(server())
        .delete(`/api/clubs/${ownClubId}`)
        .set(auth(clubAdminToken))
        .expect(403);

      await request(server())
        .post('/api/courts')
        .set(auth(clubAdminToken))
        .send({ clubId: otherClubId, name: 'Lapangan Lain' })
        .expect(403);
      const ownCourt = (
        await request(server())
          .post('/api/courts')
          .set(auth(clubAdminToken))
          .send({ clubId: ownClubId, name: 'Lapangan Sendiri' })
          .expect(201)
      ).body;

      const otherCourt = await prisma.court.create({
        data: { clubId: otherClubId, name: 'Lapangan Lain' },
      });
      await request(server())
        .get(`/api/courts/${otherCourt.id}`)
        .set(auth(clubAdminToken))
        .expect(403);
      await request(server())
        .post('/api/cameras')
        .set(auth(clubAdminToken))
        .send({
          courtId: otherCourt.id,
          name: 'Cam',
          streamPath: `court-other-${run}`,
        })
        .expect(403);

      // Filtering by another club's id returns nothing instead of leaking data.
      const courts = await request(server())
        .get(`/api/courts?clubId=${otherClubId}`)
        .set(auth(clubAdminToken))
        .expect(200);
      expect(courts.body).toEqual([]);
      const own = await request(server())
        .get('/api/courts')
        .set(auth(clubAdminToken))
        .expect(200);
      expect(own.body.map((c: { id: string }) => c.id)).toEqual([ownCourt.id]);
    });
  });
});

function randomPhone() {
  return `+62812${Math.floor(1e7 + Math.random() * 9e7)}`;
}
