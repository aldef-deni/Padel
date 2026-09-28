import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { DEMO_USERNAME } from '../src/demo/demo.service.js';
import { OtpChannel, Role } from '../src/generated/prisma/client.js';
import { MAILER } from '../src/mail/mailer.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Demo instance (DEMO_MODE=true): the shared "demo" account is advertised and protected.
describe('Demo mode (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let demoId: string;
  let demoToken: string;
  let superToken: string;
  const previous = process.env.DEMO_MODE;
  const playerEmail = `demo-player-${run}@e2e.test`;

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MAILER)
      .useValue({ kind: 'log', send: async () => {} })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    // Random passwords: even a leftover row could never be used to sign in.
    const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
    const [demo, admin] = await Promise.all([
      prisma.user.create({
        data: { username: DEMO_USERNAME, passwordHash, role: Role.CLUB_ADMIN, clubId: null },
      }),
      prisma.user.create({
        data: { username: `e2e-demo-sa-${run}`, passwordHash, role: Role.SUPER_ADMIN },
      }),
    ]);
    demoId = demo.id;
    [demoToken, superToken] = await Promise.all(
      [demo, admin].map((u) => jwt.signAsync({ sub: u.id, role: u.role })),
    );
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [{ id: demoId }, { username: `e2e-demo-sa-${run}` }, { email: playerEmail }],
      },
    });
    await prisma.otpCode.deleteMany({
      where: { channel: OtpChannel.EMAIL, target: playerEmail },
    });
    await app.close();
    if (previous === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous;
  });

  it('advertises the demo login and the next daily reset', async () => {
    const res = await request(server()).get('/api/public/config').expect(200);
    expect(res.body.demo).toMatchObject({ username: 'demo', password: 'demo' });
    const resetIn = new Date(res.body.demo.resetAt).getTime() - Date.now();
    expect(resetIn).toBeGreaterThan(0);
    expect(resetIn).toBeLessThanOrEqual(24 * 3600_000);
    expect(new Date(res.body.demo.resetAt).getUTCHours()).toBe(17); // 00:00 WIB
  });

  it('returns the player sign-in code (no SMTP on the demo instance)', async () => {
    const requested = await request(server())
      .post('/api/auth/email/request')
      .send({ email: playerEmail })
      .expect(202);
    expect(requested.body.demoCode).toMatch(/^\d{6}$/);
    const login = await request(server())
      .post('/api/auth/email/verify')
      .send({ email: playerEmail, code: requested.body.demoCode })
      .expect(200);
    expect(login.body.user).toMatchObject({ email: playerEmail, role: 'PLAYER' });
  });

  it('protects the demo account from lock-out changes', async () => {
    await request(server())
      .patch(`/api/users/${demoId}`)
      .set(auth(superToken))
      .send({ name: 'Diambil alih' })
      .expect(403);
    await request(server())
      .delete(`/api/users/${demoId}`)
      .set(auth(superToken))
      .expect(403);
    await request(server())
      .patch('/api/auth/password')
      .set(auth(demoToken))
      .send({ currentPassword: 'apa-saja-123', newPassword: 'password-baru-123' })
      .expect(403);
    await request(server())
      .patch('/api/auth/me')
      .set(auth(demoToken))
      .send({ username: `bukan-demo-${run}` })
      .expect(403);
    // Harmless profile changes still work.
    const renamed = await request(server())
      .patch('/api/auth/me')
      .set(auth(demoToken))
      .send({ name: 'Pengunjung Demo' })
      .expect(200);
    expect(renamed.body).toMatchObject({ username: 'demo', name: 'Pengunjung Demo' });
  });
});
