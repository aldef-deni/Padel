import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { existsSync } from 'node:fs';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AvatarStorage } from '../src/profile/avatar-storage.service.js';

// Profil sendiri + foto profil. Data uji memakai penanda `run`.
describe('Profile & avatar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const phone = `+62815${Math.floor(1e7 + Math.random() * 9e7)}`;
  let adminToken: string;
  let playerToken: string;
  let adminId: string;
  // 1x1 transparent PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const admin = await prisma.user.create({
      data: {
        username: `prof-${run}`,
        passwordHash: await hashPassword('rahasia-e2e-123'),
        role: Role.SUPER_ADMIN,
      },
    });
    const player = await prisma.user.create({
      data: { phone, role: Role.PLAYER },
    });
    adminId = admin.id;
    adminToken = await jwt.signAsync({ sub: admin.id, role: admin.role });
    playerToken = await jwt.signAsync({ sub: player.id, role: player.role });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { OR: [{ username: { contains: run } }, { phone }] },
    });
    const avatars = app.get(AvatarStorage);
    await Promise.all(users.map((u) => avatars.remove(u.avatarFile)));
    await prisma.user.deleteMany({
      where: { id: { in: users.map((u) => u.id) } },
    });
    await app.close();
  });

  it('updates the own profile with the same rules as user management', async () => {
    const patch = (token: string, body: object) =>
      request(server()).patch('/api/auth/me').set(auth(token)).send(body);

    const res = await patch(adminToken, {
      name: '  Aldef  ',
      email: `Prof-${run}@E2E.test`,
      phone: '0812 0000 1111',
    }).expect(200);
    expect(res.body).toMatchObject({
      name: 'Aldef',
      username: `prof-${run}`,
      email: `prof-${run}@e2e.test`,
      phone: '+6281200001111',
      role: 'SUPER_ADMIN',
      avatarUrl: null,
    });
    await patch(adminToken, { username: null }).expect(200); // email remains
    await patch(adminToken, { email: null }).expect(400); // would leave no login
    await patch(adminToken, { username: 'bad name!' }).expect(400);
    await patch(adminToken, { phone: '12' }).expect(400);
    await patch(adminToken, { username: `prof-${run}`, phone: null }).expect(
      200,
    );
    const me = await request(server())
      .get('/api/auth/me')
      .set(auth(adminToken))
      .expect(200);
    expect(me.body).toMatchObject({ username: `prof-${run}`, phone: null });

    // Players: name yes, phone no (it is their OTP login).
    await patch(playerToken, { name: 'Pemain Uji' }).expect(200);
    await patch(playerToken, { phone: '0813 0000 2222' }).expect(400);
    await request(server())
      .patch('/api/auth/me')
      .send({ name: 'x' })
      .expect(401);
  });

  it('uploads, serves and removes the avatar', async () => {
    const upload = (buf: Buffer, name: string) =>
      request(server())
        .post('/api/auth/me/avatar')
        .set(auth(adminToken))
        .attach('file', buf, name);

    await upload(Buffer.from('<svg onload="alert(1)"/>'), 'a.svg').expect(400);
    await upload(Buffer.alloc(2 * 1024 * 1024 + 1), 'big.png').expect(413);

    const res = await upload(png, 'me.png').expect(201);
    expect(res.body.avatarUrl).toMatch(
      new RegExp(`^/api/users/${adminId}/avatar\\?v=`),
    );
    const file = await prisma.user.findUniqueOrThrow({
      where: { id: adminId },
    });
    const path = app.get(AvatarStorage).filePath(file.avatarFile!);
    expect(existsSync(path)).toBe(true);

    const img = await request(server()).get(res.body.avatarUrl).expect(200); // public
    expect(img.headers['content-type']).toBe('image/png');
    expect(Buffer.from(img.body)).toEqual(png);

    // Shown in the user list for super admins.
    const list = await request(server())
      .get(`/api/users?search=prof-${run}`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body.items[0].avatarUrl).toBe(res.body.avatarUrl);

    // Replacing deletes the old file; removing clears it.
    const second = await upload(png, 'me2.png').expect(201);
    expect(second.body.avatarUrl).not.toBe(res.body.avatarUrl);
    expect(existsSync(path)).toBe(false);
    const removed = await request(server())
      .delete('/api/auth/me/avatar')
      .set(auth(adminToken))
      .expect(200);
    expect(removed.body.avatarUrl).toBeNull();
    await request(server()).get(`/api/users/${adminId}/avatar`).expect(404);
  });
});
