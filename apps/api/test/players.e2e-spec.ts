import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/auth/password.js';
import { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Pemain klub (admin klub). Semua data uji memakai penanda `run` / nomor acak.
describe('Club players (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const n = () => String(Math.floor(1e7 + Math.random() * 9e7));
  const phoneA = n();
  const phoneB = n();
  const phoneAdmin = n();
  const password = 'rahasia-e2e-123';
  let clubA: string;
  let clubB: string;
  let adminA: string;
  let adminB: string;
  let superToken: string;
  let jwt: JwtService;

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const tokenFor = (u: { id: string; role: Role }) =>
    jwt.signAsync({ sub: u.id, role: u.role });

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    [clubA, clubB] = (
      await Promise.all(
        ['a', 'b'].map((k) =>
          prisma.club.create({
            data: { name: `Klub ${k} ${run}`, slug: `e2e-pl-${k}-${run}` },
          }),
        ),
      )
    ).map((c) => c.id);
    const passwordHash = await hashPassword(password);
    const [a, b, sa] = await Promise.all([
      prisma.user.create({
        data: {
          username: `pa-${run}`,
          passwordHash,
          role: Role.CLUB_ADMIN,
          clubId: clubA,
        },
      }),
      prisma.user.create({
        data: {
          username: `pb-${run}`,
          passwordHash,
          role: Role.CLUB_ADMIN,
          clubId: clubB,
          phone: `+62813${phoneAdmin}`,
        },
      }),
      prisma.user.create({
        data: { username: `ps-${run}`, passwordHash, role: Role.SUPER_ADMIN },
      }),
    ]);
    [adminA, adminB, superToken] = await Promise.all([a, b, sa].map(tokenFor));
  });

  afterAll(async () => {
    const clubs = { in: [clubA, clubB] };
    await prisma.session.deleteMany({ where: { court: { clubId: clubs } } });
    await prisma.camera.deleteMany({ where: { court: { clubId: clubs } } });
    await prisma.court.deleteMany({ where: { clubId: clubs } });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { username: { endsWith: run } },
          {
            phone: {
              in: [`+62811${phoneA}`, `+62812${phoneB}`, `+62813${phoneAdmin}`],
            },
          },
        ],
      },
    });
    await prisma.club.deleteMany({ where: { id: clubs } });
    await app.close();
  });

  const players = (clubId: string) => `/api/clubs/${clubId}/players`;

  it('adds players by phone and links existing accounts instead of duplicating', async () => {
    await request(server())
      .post(players(clubA))
      .set(auth(adminA))
      .send({ phone: '12' })
      .expect(400);
    await request(server())
      .post(players(clubA))
      .set(auth(adminA))
      .send({ name: 'Tanpa kontak' })
      .expect(400);
    const byEmail = await request(server())
      .post(players(clubA))
      .set(auth(adminA))
      .send({ email: `Email-${run}@E2E.test`, name: 'Pemain Email' })
      .expect(201);
    expect(byEmail.body).toMatchObject({
      existingAccount: false,
      player: {
        email: `email-${run}@e2e.test`,
        phone: null,
        name: 'Pemain Email',
      },
    });
    await request(server())
      .delete(`${players(clubA)}/${byEmail.body.player.id}`)
      .set(auth(adminA))
      .expect(204);
    await prisma.user.delete({ where: { id: byEmail.body.player.id } });

    const created = await request(server())
      .post(players(clubA))
      .set(auth(adminA))
      .send({
        phone: `0811${phoneA}`,
        name: ' Budi ',
        email: 'Budi@E2E.test',
        note: 'Member VIP',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      existingAccount: false,
      player: {
        name: 'Budi',
        phone: `+62811${phoneA}`,
        email: 'budi@e2e.test',
        note: 'Member VIP',
        isBlocked: false,
        accountActive: true,
        sessionsCount: 0,
        clipsCount: 0,
        lastPlayedAt: null,
      },
    });
    await request(server())
      .post(players(clubA))
      .set(auth(adminA))
      .send({ phone: `+62811${phoneA}` })
      .expect(409);
    // A phone of an admin account cannot become a player.
    await request(server())
      .post(players(clubA))
      .set(auth(adminA))
      .send({ phone: `0813${phoneAdmin}` })
      .expect(409);

    // Club B adds the same number: linked, and B's name does not overwrite the player's.
    const linked = await request(server())
      .post(players(clubB))
      .set(auth(adminB))
      .send({ phone: `0811${phoneA}`, name: 'Nama Lain' })
      .expect(201);
    expect(linked.body).toMatchObject({
      existingAccount: true,
      player: { name: 'Budi', note: null },
    });
    expect(
      await prisma.user.count({ where: { phone: `+62811${phoneA}` } }),
    ).toBe(1);
  });

  it('is scoped to the club', async () => {
    await request(server()).get(players(clubA)).set(auth(adminB)).expect(403);
    const player = await prisma.user.findUniqueOrThrow({
      where: { phone: `+62811${phoneA}` },
    });
    await request(server())
      .get(players(clubA))
      .set(auth(await tokenFor(player)))
      .expect(403);
    const asSuper = await request(server())
      .get(players(clubA))
      .set(auth(superToken))
      .expect(200);
    expect(asSuper.body.total).toBe(1);
  });

  it('lists with search, status filter and counts; updates and blocks', async () => {
    await request(server())
      .post(players(clubA))
      .set(auth(adminA))
      .send({ phone: `0812${phoneB}`, name: 'Citra' })
      .expect(201);
    const citra = await prisma.user.findUniqueOrThrow({
      where: { phone: `+62812${phoneB}` },
    });

    const search = await request(server())
      .get(`${players(clubA)}?search=citra`)
      .set(auth(adminA))
      .expect(200);
    expect(search.body.items.map((p: { name: string }) => p.name)).toEqual([
      'Citra',
    ]);

    const updated = await request(server())
      .patch(`${players(clubA)}/${citra.id}`)
      .set(auth(adminA))
      .send({
        name: 'Citra Dewi',
        email: null,
        note: 'Suka main pagi',
        isBlocked: true,
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'Citra Dewi',
      email: null,
      note: 'Suka main pagi',
      isBlocked: true,
    });
    await request(server())
      .patch(`${players(clubA)}/${citra.id}`)
      .set(auth(adminA))
      .send({ phone: `0811${phoneA}` }) // Budi's number
      .expect(409);

    const blocked = await request(server())
      .get(`${players(clubA)}?status=BLOCKED`)
      .set(auth(adminA))
      .expect(200);
    expect(blocked.body.items.map((p: { id: string }) => p.id)).toEqual([
      citra.id,
    ]);
    expect(blocked.body.counts).toEqual({ ALL: 2, ACTIVE: 1, BLOCKED: 1 });

    // Club B's view of Budi is independent of club A.
    const budiInB = await request(server())
      .get(players(clubB))
      .set(auth(adminB))
      .expect(200);
    expect(budiInB.body.counts).toEqual({ ALL: 1, ACTIVE: 1, BLOCKED: 0 });
  });

  it('blocks joining sessions and replays; joining makes non-members members', async () => {
    const court = await prisma.court.create({
      data: {
        clubId: clubA,
        name: 'Lapangan',
        cameras: { create: { name: 'Cam', streamPath: `court-pl-${run}` } },
      },
    });
    const session = (
      await request(server())
        .post(`/api/courts/${court.id}/sessions`)
        .set(auth(adminA))
        .expect(201)
    ).body;
    const citra = await prisma.user.findUniqueOrThrow({
      where: { phone: `+62812${phoneB}` },
    });
    const budi = await prisma.user.findUniqueOrThrow({
      where: { phone: `+62811${phoneA}` },
    });
    const join = async (u: { id: string; role: Role }) =>
      request(server())
        .post('/api/sessions/join')
        .set(auth(await tokenFor(u)))
        .send({ qrToken: session.qrToken });

    const refused = await join(citra);
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/blocked/);

    expect((await join(budi)).status).toBe(200);
    const budiRow = (
      await request(server())
        .get(`${players(clubA)}?search=budi`)
        .set(auth(adminA))
        .expect(200)
    ).body.items[0];
    expect(budiRow.sessionsCount).toBe(1);
    expect(budiRow.lastPlayedAt).not.toBeNull();

    // Blocked after joining: no more replays.
    await request(server())
      .patch(`${players(clubA)}/${budi.id}`)
      .set(auth(adminA))
      .send({ isBlocked: true })
      .expect(200);
    await request(server())
      .post(`/api/sessions/${session.id}/replays`)
      .set(auth(await tokenFor(budi)))
      .send({})
      .expect(403);

    // A player who was never added joins via QR and shows up in the club's list.
    const walkIn = await prisma.user.create({
      data: {
        phone: `+62819${n()}`,
        role: Role.PLAYER,
        name: `Walk-in ${run}`,
        username: `walkin-${run}`,
      },
    });
    expect((await join(walkIn)).status).toBe(200);
    const list = await request(server())
      .get(`${players(clubA)}?search=walk-in`)
      .set(auth(adminA))
      .expect(200);
    expect(list.body.items.map((p: { id: string }) => p.id)).toEqual([
      walkIn.id,
    ]);
  });

  it('removing a player ends the membership but keeps the account', async () => {
    const citra = await prisma.user.findUniqueOrThrow({
      where: { phone: `+62812${phoneB}` },
    });
    await request(server())
      .delete(`${players(clubA)}/${citra.id}`)
      .set(auth(adminB))
      .expect(403);
    await request(server())
      .delete(`${players(clubA)}/${citra.id}`)
      .set(auth(adminA))
      .expect(204);
    await request(server())
      .delete(`${players(clubA)}/${citra.id}`)
      .set(auth(adminA))
      .expect(404);
    expect(
      await prisma.user.findUnique({ where: { id: citra.id } }),
    ).not.toBeNull();
    const list = await request(server())
      .get(`${players(clubA)}?search=citra`)
      .set(auth(adminA))
      .expect(200);
    expect(list.body.items).toEqual([]);
  });
});
