import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { TournamentDetail, TournamentMatch } from '@padel/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Role } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Tournament manager. Semua data uji memakai penanda `run`.
describe('Tournaments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  let clubA: string;
  let clubB: string;
  let courtA: string;
  let courtB: string;
  let adminA: string;
  let adminB: string;

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = (token: string) => ({
    get: (path: string) =>
      request(server()).get(`/api/tournaments${path}`).set(auth(token)),
    post: (path: string, body: object = {}) =>
      request(server())
        .post(`/api/tournaments${path}`)
        .set(auth(token))
        .send(body),
    patch: (path: string, body: object) =>
      request(server())
        .patch(`/api/tournaments${path}`)
        .set(auth(token))
        .send(body),
    del: (path: string) =>
      request(server()).delete(`/api/tournaments${path}`).set(auth(token)),
  });

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    const [a, b] = await Promise.all(
      ['a', 'b'].map((k) =>
        prisma.club.create({
          data: {
            name: `Klub T${k} ${run}`,
            slug: `e2e-t-${k}-${run}`,
            courts: { create: { name: 'Lapangan 1' } },
          },
          include: { courts: true },
        }),
      ),
    );
    clubA = a.id;
    clubB = b.id;
    courtA = a.courts[0].id;
    courtB = b.courts[0].id;
    const [ua, ub] = await Promise.all(
      [clubA, clubB].map((clubId, i) =>
        prisma.user.create({
          data: { username: `t${i}-${run}`, role: Role.CLUB_ADMIN, clubId },
        }),
      ),
    );
    adminA = await jwt.signAsync({ sub: ua.id, role: ua.role });
    adminB = await jwt.signAsync({ sub: ub.id, role: ub.role });
  });

  afterAll(async () => {
    const clubs = { in: [clubA, clubB] };
    await prisma.tournament.deleteMany({ where: { clubId: clubs } });
    await prisma.court.deleteMany({ where: { clubId: clubs } });
    await prisma.user.deleteMany({ where: { username: { endsWith: run } } });
    await prisma.club.deleteMany({ where: { id: clubs } });
    await app.close();
  });

  const create = async (body: object): Promise<TournamentDetail> =>
    (
      await api(adminA)
        .post('', {
          clubId: clubA,
          startDate: '2026-10-18',
          name: `Cup ${run}`,
          ...body,
        })
        .expect(201)
    ).body;

  const addTeams = async (id: string, n: number, seeded = 0) => {
    let t!: TournamentDetail;
    for (let i = 1; i <= n; i++) {
      t = (
        await api(adminA)
          .post(`/${id}/teams`, {
            player1Name: `P${i}a`,
            player2Name: `P${i}b`,
            ...(i <= seeded ? { seed: i } : {}),
          })
          .expect(201)
      ).body;
    }
    return t;
  };

  const teamName = (t: TournamentDetail, id: string | null) =>
    t.teams.find((x) => x.id === id)?.name;
  const win = {
    sets: [
      { a: 6, b: 2 },
      { a: 6, b: 3 },
    ],
  };
  const loseA = {
    sets: [
      { a: 2, b: 6 },
      { a: 3, b: 6 },
    ],
  };
  const result = (
    t: TournamentDetail,
    m: TournamentMatch,
    body: object = win,
  ) => api(adminA).post(`/${t.id}/matches/${m.id}/result`, body);
  const knockout = (t: TournamentDetail) =>
    t.matches.filter((m) => m.stage === 'KNOCKOUT');

  it('creates tournaments with validation and club scoping', async () => {
    await api(adminA)
      .post('', {
        clubId: clubA,
        name: 'X',
        startDate: '2026-10-18',
        format: 'SWISS',
      })
      .expect(400);
    await api(adminA)
      .post('', {
        clubId: clubA,
        name: 'X',
        startDate: '2026-10-18',
        endDate: '2026-10-01',
        format: 'ROUND_ROBIN',
      })
      .expect(400);
    await api(adminA)
      .post('', {
        clubId: clubB,
        name: 'X',
        startDate: '2026-10-18',
        format: 'ROUND_ROBIN',
      })
      .expect(403);

    const t = await create({
      format: 'ROUND_ROBIN',
      category: 'Men Open',
      entryFee: 250000,
      maxTeams: 3,
    });
    expect(t).toMatchObject({
      status: 'DRAFT',
      category: 'Men Open',
      entryFee: 250000,
      setsToWin: 2,
      gamesPerSet: 6,
      superTiebreak: true,
      teamCount: 0,
      club: { id: clubA },
    });
    expect(t.slug).toMatch(new RegExp(`^cup-${run}-[0-9a-f]{6}$`));
    await api(adminB).get(`/${t.id}`).expect(403);

    // Roster rules
    await addTeams(t.id, 3);
    await api(adminA)
      .post(`/${t.id}/teams`, { player1Name: 'X', player2Name: 'Y' })
      .expect(409); // full
    await api(adminA).patch(`/${t.id}`, { maxTeams: 8 }).expect(200);
    await api(adminA)
      .post(`/${t.id}/teams`, { player1Name: 'P1a', player2Name: 'P1b' })
      .expect(409); // same name
    await api(adminA)
      .post(`/${t.id}/teams`, {
        player1Name: 'X',
        player2Name: 'Y',
        player1Id: 'bukan-akun',
      })
      .expect(400);

    const list = await api(adminA)
      .get(`?clubId=${clubA}&search=${run}`)
      .expect(200);
    expect(list.body.counts).toMatchObject({ ALL: 1, DRAFT: 1 });
    expect(list.body.items[0]).toMatchObject({ id: t.id, teamCount: 3 });
    const listB = await api(adminB).get('').expect(200);
    expect(listB.body.items.map((x: { id: string }) => x.id)).not.toContain(
      t.id,
    );

    // Draft is not public; deletable.
    await request(server())
      .get(`/api/public/tournaments/${t.slug}`)
      .expect(404);
    await api(adminA).del(`/${t.id}`).expect(204);
  });

  it('single elimination: byes, advancement, 3rd place, champion, corrections', async () => {
    let t = await create({
      format: 'SINGLE_ELIMINATION',
      thirdPlaceMatch: true,
    });
    await api(adminA).post(`/${t.id}/draw`).expect(400); // no teams
    t = await addTeams(t.id, 5, 5);
    await api(adminA)
      .post(`/${t.id}/status`, { status: 'REGISTRATION' })
      .expect(200);

    t = (
      await api(adminA).post(`/${t.id}/draw`, { shuffle: false }).expect(200)
    ).body;
    expect(t.status).toBe('ONGOING');
    expect(t.knockoutRounds).toBe(3); // 5 teams -> bracket of 8
    const r1 = knockout(t).filter((m) => m.round === 1);
    expect(r1).toHaveLength(4);
    expect(r1.filter((m) => m.status === 'BYE')).toHaveLength(3);
    // Seeds 1-3 get byes and already sit in round 2; seed 4 plays seed 5.
    const real = r1.find((m) => m.status === 'SCHEDULED')!;
    expect(
      [teamName(t, real.teamAId), teamName(t, real.teamBId)].sort((x, y) =>
        x!.localeCompare(y!),
      ),
    ).toEqual(['P4a / P4b', 'P5a / P5b']);
    expect(t.matchCount).toBe(5); // 1 + 2 semis + final + 3rd place (byes not counted)

    // Frozen after the draw.
    await api(adminA).patch(`/${t.id}`, { format: 'ROUND_ROBIN' }).expect(409);
    await api(adminA)
      .post(`/${t.id}/teams`, { player1Name: 'X', player2Name: 'Y' })
      .expect(409);
    await api(adminA).del(`/${t.id}`).expect(409);

    // Scheduling
    await api(adminA)
      .patch(`/${t.id}/matches/${real.id}`, { courtId: courtB })
      .expect(400);
    t = (
      await api(adminA)
        .patch(`/${t.id}/matches/${real.id}`, {
          courtId: courtA,
          scheduledAt: '2026-10-18T09:00:00+07:00',
        })
        .expect(200)
    ).body;
    expect(t.matches.find((m) => m.id === real.id)).toMatchObject({
      court: { id: courtA },
      scheduledAt: '2026-10-18T02:00:00.000Z',
    });

    // Invalid scores
    await result(t, real, {
      sets: [
        { a: 6, b: 5 },
        { a: 6, b: 0 },
      ],
    }).expect(400);
    await result(t, real, { sets: [{ a: 6, b: 0 }] }).expect(400);
    await result(t, real, { sets: win.sets, walkover: 'A' }).expect(400);
    // A semi can't be played before both teams are known.
    const semis = () => knockout(t).filter((m) => m.round === 2);
    const openSemi = semis().find((m) => !m.teamAId || !m.teamBId)!;
    await result(t, openSemi).expect(409);

    // Round 1: seed 5 upsets seed 4 (super tie-break) -> advances.
    t = (
      await result(t, real, {
        sets: [
          { a: 6, b: 4 },
          { a: 3, b: 6 },
          { a: 8, b: 10 },
        ],
      }).expect(200)
    ).body;
    const winner1 = t.matches.find((m) => m.id === real.id)!.winnerId;
    expect(teamName(t, winner1)).toBe('P5a / P5b');
    expect(semis().every((m) => m.teamAId && m.teamBId)).toBe(true);

    // Semis: team A wins both -> losers go to the 3rd-place match.
    for (const semi of semis()) t = (await result(t, semi).expect(200)).body;
    const final = knockout(t).find((m) => m.round === 3 && !m.isThirdPlace)!;
    const third = knockout(t).find((m) => m.isThirdPlace)!;
    expect(
      final.teamAId && final.teamBId && third.teamAId && third.teamBId,
    ).toBeTruthy();

    t = (await result(t, final, loseA).expect(200)).body;
    expect(t.status).toBe('ONGOING'); // 3rd place pending
    t = (await result(t, third, { walkover: 'B' }).expect(200)).body;
    expect(t.status).toBe('COMPLETED');
    expect(t.championTeamId).toBe(final.teamBId);
    expect(t.championName).toBe(teamName(t, final.teamBId));
    expect(t.finishedMatchCount).toBe(5);

    // Correcting a semi after the final was played is blocked; undo the final first.
    const semi = semis()[0];
    await result(t, semi, loseA).expect(409);
    t = (
      await api(adminA).del(`/${t.id}/matches/${final.id}/result`).expect(200)
    ).body;
    expect(t).toMatchObject({ status: 'ONGOING', championTeamId: null });
    // The semi also fed the 3rd-place match: that result must go too.
    await result(t, semi, loseA).expect(409);
    t = (
      await api(adminA).del(`/${t.id}/matches/${third.id}/result`).expect(200)
    ).body;
    t = (await result(t, semi, loseA).expect(200)).body;
    const newFinal = t.matches.find((m) => m.id === final.id)!;
    expect(newFinal.teamAId).toBe(semi.teamBId); // the corrected winner moved up

    // Public page: no admin data.
    const pub = await request(server())
      .get(`/api/public/tournaments/${t.slug}`)
      .expect(200);
    expect(pub.body.teams[0]).toMatchObject({ player1Id: null, note: null });
    await api(adminA).patch(`/${t.id}`, { isPublic: false }).expect(200);
    await request(server())
      .get(`/api/public/tournaments/${t.slug}`)
      .expect(404);

    // Cancel, then delete.
    await api(adminA)
      .post(`/${t.id}/status`, { status: 'CANCELLED' })
      .expect(200);
    await api(adminA).del(`/${t.id}`).expect(204);
  });

  it('round robin: schedule, standings and champion', async () => {
    let t = await create({
      format: 'ROUND_ROBIN',
      setsToWin: 1,
      gamesPerSet: 9,
    });
    t = await addTeams(t.id, 4);
    t = (await api(adminA).post(`/${t.id}/draw`).expect(200)).body;
    expect(t.groups).toHaveLength(1);
    expect(t.matches).toHaveLength(6);
    expect(new Set(t.matches.map((m) => m.round)).size).toBe(3);

    // Seed the outcome: the team named P1 wins everything, P4 loses everything.
    const rank = (id: string | null) => Number(teamName(t, id)!.slice(1, 2));
    for (const m of t.matches) {
      const aBetter = rank(m.teamAId) < rank(m.teamBId);
      t = (
        await result(t, m, {
          sets: [aBetter ? { a: 9, b: 7 } : { a: 7, b: 9 }],
        }).expect(200)
      ).body;
    }
    expect(t.status).toBe('COMPLETED');
    const table = t.groups[0].standings;
    expect(table.map((r) => teamName(t, r.teamId))).toEqual([
      'P1a / P1b',
      'P2a / P2b',
      'P3a / P3b',
      'P4a / P4b',
    ]);
    expect(table[0]).toMatchObject({
      played: 3,
      won: 3,
      lost: 0,
      points: 3,
      setsWon: 3,
      gamesWon: 27,
      gamesLost: 21,
    });
    expect(t.championName).toBe('P1a / P1b');

    // Undo one result -> back to ongoing without champion.
    t = (
      await api(adminA)
        .del(`/${t.id}/matches/${t.matches[0].id}/result`)
        .expect(200)
    ).body;
    expect(t).toMatchObject({ status: 'ONGOING', championTeamId: null });
  });

  it('groups + knockout: snake groups, cross-seeded knockout, reset', async () => {
    let t = await create({
      format: 'GROUPS_KNOCKOUT',
      groupCount: 2,
      advancePerGroup: 2,
    });
    t = await addTeams(t.id, 3);
    await api(adminA).post(`/${t.id}/draw`).expect(400); // 2 groups need 4 teams
    for (const team of t.teams)
      t = (await api(adminA).del(`/${t.id}/teams/${team.id}`).expect(200)).body;
    t = await addTeams(t.id, 8, 8);
    expect(t.teamCount).toBe(8);

    t = (
      await api(adminA).post(`/${t.id}/draw`, { shuffle: false }).expect(200)
    ).body;
    expect(t.groups.map((g) => g.name)).toEqual(['A', 'B']);
    const groupOf = (seed: number) =>
      t.teams.find((x) => x.seed === seed)!.groupId;
    // Snake: A = seeds 1,4,5,8  B = 2,3,6,7
    expect([1, 4, 5, 8].every((s) => groupOf(s) === t.groups[0].id)).toBe(true);
    expect([2, 3, 6, 7].every((s) => groupOf(s) === t.groups[1].id)).toBe(true);
    expect(t.matches).toHaveLength(12);

    await api(adminA).post(`/${t.id}/knockout`).expect(409); // groups not finished

    // Lower seed number wins every group match.
    const seedOf = (id: string | null) =>
      t.teams.find((x) => x.id === id)!.seed!;
    for (const m of t.matches) {
      t = (
        await result(
          t,
          m,
          seedOf(m.teamAId) < seedOf(m.teamBId) ? win : loseA,
        ).expect(200)
      ).body;
    }
    const standings = t.groups.map((g) =>
      g.standings.map((r) => seedOf(r.teamId)),
    );
    expect(standings).toEqual([
      [1, 4, 5, 8],
      [2, 3, 6, 7],
    ]);

    t = (await api(adminA).post(`/${t.id}/knockout`).expect(200)).body;
    const semis = knockout(t).filter((m) => m.round === 1);
    const pairs = semis.map((m) =>
      [seedOf(m.teamAId), seedOf(m.teamBId)].sort((x, y) => x - y),
    );
    // A1 (1) vs B2 (3), B1 (2) vs A2 (4): no same-group rematch.
    expect(pairs.sort((x, y) => x[0] - y[0])).toEqual([
      [1, 3],
      [2, 4],
    ]);
    await api(adminA).post(`/${t.id}/knockout`).expect(409); // exists
    // Group results are frozen while the knockout exists.
    await result(t, t.matches[0], loseA).expect(409);
    t = (await api(adminA).del(`/${t.id}/knockout`).expect(200)).body;
    expect(knockout(t)).toHaveLength(0);

    // Reset draw is blocked by results.
    await api(adminA).del(`/${t.id}/draw`).expect(409);
  });
});
