import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  TournamentDetail,
  TournamentListResponse,
  TournamentMatch as MatchDto,
  TournamentSummary,
} from '@padel/shared';
import { randomBytes } from 'node:crypto';
import {
  assertClubAccess,
  clubScope,
  type AuthUser,
} from '../auth/auth-user.js';
import { clubLogoUrl } from '../clubs/entities/club.entity.js';
import {
  Prisma,
  Role,
  TournamentFormat,
  TournamentMatchStatus,
  TournamentStage,
  TournamentStatus,
  TournamentTeamStatus,
  type Tournament,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateTournamentDto,
  DrawDto,
  ListTournamentsQuery,
  MatchResultDto,
  ScheduleMatchDto,
  TeamDto,
  UpdateTeamDto,
  UpdateTournamentDto,
} from './dto/tournament.dto.js';
import {
  computeStandings,
  drawOrder,
  evaluateSets,
  nextPowerOfTwo,
  qualifierSeeds,
  roundRobinRounds,
  seedPositions,
  snakeGroups,
  type FinishedMatch,
  type ScoringRules,
  type SetScore,
} from './engine.js';

type Tx = Prisma.TransactionClient;

const FINISHED: TournamentMatchStatus[] = [
  TournamentMatchStatus.COMPLETED,
  TournamentMatchStatus.WALKOVER,
];
/** Settings that shape the draw: frozen once matches exist. */
const STRUCTURAL = [
  'format',
  'setsToWin',
  'gamesPerSet',
  'superTiebreak',
  'groupCount',
  'advancePerGroup',
  'thirdPlaceMatch',
] as const;

const detailInclude = {
  club: { select: { id: true, name: true, logoFile: true } },
  champion: { select: { name: true } },
  teams: {
    orderBy: [{ seed: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  },
  groups: { orderBy: { order: 'asc' } },
  matches: {
    include: { court: { select: { id: true, name: true } } },
    orderBy: [{ stage: 'asc' }, { round: 'asc' }, { position: 'asc' }],
  },
} satisfies Prisma.TournamentInclude;
type DetailRow = Prisma.TournamentGetPayload<{ include: typeof detailInclude }>;

/**
 * Tournament manager for a club: settings, teams (pairs), draws for knockout / round robin /
 * groups + knockout, scheduling, results with automatic advancement and standings.
 */
@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Read ----

  async list(
    user: AuthUser,
    query: ListTournamentsQuery,
  ): Promise<TournamentListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const search = query.search?.trim();
    const base: Prisma.TournamentWhereInput = {
      AND: [{ clubId: clubScope(user) }, { clubId: query.clubId }],
      ...(search
        ? {
            OR: (['name', 'category'] as const).map((field) => ({
              [field]: { contains: search, mode: 'insensitive' as const },
            })),
          }
        : {}),
    };
    const where: Prisma.TournamentWhereInput = {
      ...base,
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total, grouped] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        include: {
          club: { select: { id: true, name: true, logoFile: true } },
          champion: { select: { name: true } },
        },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tournament.count({ where }),
      this.prisma.tournament.groupBy({
        by: ['status'],
        where: base,
        _count: { _all: true },
      }),
    ]);

    const items = await Promise.all(
      rows.map(async (t) => {
        const [teamCount, matchCount, finishedMatchCount] = await Promise.all([
          this.prisma.tournamentTeam.count({
            where: {
              tournamentId: t.id,
              status: { not: TournamentTeamStatus.WITHDRAWN },
            },
          }),
          this.prisma.tournamentMatch.count({
            where: {
              tournamentId: t.id,
              status: { not: TournamentMatchStatus.BYE },
            },
          }),
          this.prisma.tournamentMatch.count({
            where: { tournamentId: t.id, status: { in: FINISHED } },
          }),
        ]);
        return toSummary(t, { teamCount, matchCount, finishedMatchCount });
      }),
    );

    const counts = {
      ALL: 0,
      DRAFT: 0,
      REGISTRATION: 0,
      ONGOING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const g of grouped) {
      counts[g.status] = g._count._all;
      counts.ALL += g._count._all;
    }
    return { items, total, page, pageSize, counts };
  }

  async get(user: AuthUser, id: string): Promise<TournamentDetail> {
    await this.load(user, id);
    return this.detail(id);
  }

  /** Public page (/t/<slug>): published tournaments only, without admin data. */
  async getPublic(slug: string): Promise<TournamentDetail> {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true, isPublic: true, status: true },
    });
    if (!t || !t.isPublic || t.status === TournamentStatus.DRAFT)
      throw new NotFoundException('Tournament not found');
    const detail = await this.detail(t.id);
    return {
      ...detail,
      teams: detail.teams.map((team) => ({
        ...team,
        player1Id: null,
        player2Id: null,
        note: null,
        paid: false,
      })),
    };
  }

  // ---- Tournament ----

  async create(
    user: AuthUser,
    dto: CreateTournamentDto,
  ): Promise<TournamentDetail> {
    assertClubAccess(user, dto.clubId);
    const club = await this.prisma.club.findUnique({
      where: { id: dto.clubId },
      select: { id: true },
    });
    if (!club) throw new BadRequestException('Club does not exist');
    checkDates(dto.startDate, dto.endDate, dto.registrationDeadline);

    const t = await this.prisma.tournament.create({
      data: {
        ...tournamentData(dto),
        name: dto.name.trim(),
        startDate: new Date(dto.startDate),
        format: dto.format,
        club: { connect: { id: dto.clubId } },
        slug: await this.uniqueSlug(dto.name),
      } as Prisma.TournamentCreateInput,
    });
    return this.detail(t.id);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateTournamentDto,
  ): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    const hasDraw =
      (await this.prisma.tournamentMatch.count({
        where: { tournamentId: id },
      })) > 0;
    const changed = STRUCTURAL.filter(
      (key) => dto[key] !== undefined && dto[key] !== t[key],
    );
    if (hasDraw && changed.length > 0) {
      throw new ConflictException(
        `Reset the draw before changing: ${changed.join(', ')}`,
      );
    }
    checkDates(
      dto.startDate ?? t.startDate.toISOString(),
      dto.endDate === undefined ? t.endDate?.toISOString() : dto.endDate,
      dto.registrationDeadline === undefined
        ? t.registrationDeadline?.toISOString()
        : dto.registrationDeadline,
    );

    await this.prisma.tournament.update({
      where: { id },
      data: {
        ...tournamentData(dto),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: new Date(dto.startDate) }
          : {}),
        ...(dto.format !== undefined ? { format: dto.format } : {}),
      },
    });
    return this.detail(id);
  }

  /** Only tournaments that have not started (or were cancelled) can be deleted. */
  async remove(user: AuthUser, id: string) {
    const t = await this.load(user, id);
    if (
      t.status === TournamentStatus.ONGOING ||
      t.status === TournamentStatus.COMPLETED
    ) {
      throw new ConflictException(
        'An ongoing or completed tournament cannot be deleted; cancel it instead',
      );
    }
    await this.prisma.tournament.delete({ where: { id } });
  }

  /** Manual status changes: open/close registration and cancel. ONGOING/COMPLETED follow the draw and results. */
  async setStatus(
    user: AuthUser,
    id: string,
    status: 'DRAFT' | 'REGISTRATION' | 'CANCELLED',
  ): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    const hasDraw =
      (await this.prisma.tournamentMatch.count({
        where: { tournamentId: id },
      })) > 0;
    const allowed =
      status === TournamentStatus.CANCELLED
        ? t.status !== TournamentStatus.COMPLETED
        : !hasDraw &&
          (
            [
              TournamentStatus.DRAFT,
              TournamentStatus.REGISTRATION,
              TournamentStatus.CANCELLED,
            ] as TournamentStatus[]
          ).includes(t.status);
    if (!allowed)
      throw new ConflictException(
        `Cannot change status from ${t.status} to ${status}`,
      );
    await this.prisma.tournament.update({ where: { id }, data: { status } });
    return this.detail(id);
  }

  // ---- Teams ----

  async addTeam(
    user: AuthUser,
    id: string,
    dto: TeamDto,
  ): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    assertRosterOpen(t);
    if (t.maxTeams) {
      const active = await this.prisma.tournamentTeam.count({
        where: {
          tournamentId: id,
          status: { not: TournamentTeamStatus.WITHDRAWN },
        },
      });
      if (active >= t.maxTeams)
        throw new ConflictException(`Tournament is full (${t.maxTeams} teams)`);
    }
    await this.checkPlayers(dto.player1Id, dto.player2Id);
    await this.prisma.tournamentTeam.create({
      data: {
        tournamentId: id,
        name:
          clean(dto.name) ??
          `${dto.player1Name.trim()} / ${dto.player2Name.trim()}`,
        player1Name: dto.player1Name.trim(),
        player2Name: dto.player2Name.trim(),
        player1Id: dto.player1Id ?? null,
        player2Id: dto.player2Id ?? null,
        seed: dto.seed ?? null,
        status: dto.status ?? TournamentTeamStatus.REGISTERED,
        paid: dto.paid ?? false,
        note: clean(dto.note),
      },
    });
    return this.detail(id);
  }

  async updateTeam(
    user: AuthUser,
    id: string,
    teamId: string,
    dto: UpdateTeamDto,
  ): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    const team = await this.prisma.tournamentTeam.findFirst({
      where: { id: teamId, tournamentId: id },
    });
    if (!team) throw new NotFoundException('Team not found');
    // After the draw only cosmetic fields may change; seeds and entries are frozen.
    if (dto.seed !== undefined || dto.status !== undefined) {
      if (dto.seed !== undefined && dto.seed !== team.seed) assertRosterOpen(t);
      if (dto.status !== undefined && dto.status !== team.status)
        assertRosterOpen(t);
    }
    await this.checkPlayers(dto.player1Id, dto.player2Id);

    const player1Name = dto.player1Name?.trim() ?? team.player1Name;
    const player2Name = dto.player2Name?.trim() ?? team.player2Name;
    await this.prisma.tournamentTeam.update({
      where: { id: teamId },
      data: {
        name:
          dto.name !== undefined
            ? (clean(dto.name) ?? `${player1Name} / ${player2Name}`)
            : undefined,
        player1Name,
        player2Name,
        player1Id: dto.player1Id,
        player2Id: dto.player2Id,
        seed: dto.seed,
        status: dto.status,
        paid: dto.paid,
        note: dto.note !== undefined ? clean(dto.note) : undefined,
      },
    });
    return this.detail(id);
  }

  async removeTeam(
    user: AuthUser,
    id: string,
    teamId: string,
  ): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    assertRosterOpen(t);
    const { count } = await this.prisma.tournamentTeam.deleteMany({
      where: { id: teamId, tournamentId: id },
    });
    if (!count) throw new NotFoundException('Team not found');
    return this.detail(id);
  }

  // ---- Draw ----

  /** Builds groups and/or bracket from the active teams and starts the tournament. */
  async draw(
    user: AuthUser,
    id: string,
    dto: DrawDto,
  ): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    if (
      t.status !== TournamentStatus.DRAFT &&
      t.status !== TournamentStatus.REGISTRATION
    ) {
      throw new ConflictException(
        'The draw can only be made before the tournament starts',
      );
    }
    const teams = await this.prisma.tournamentTeam.findMany({
      where: {
        tournamentId: id,
        status: { not: TournamentTeamStatus.WITHDRAWN },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (teams.length < 2)
      throw new BadRequestException('At least 2 teams are needed');
    const ordered = drawOrder(teams, dto.shuffle ?? true).map(
      (team) => team.id,
    );

    if (t.format === TournamentFormat.GROUPS_KNOCKOUT) {
      if (teams.length < t.groupCount * 2) {
        throw new BadRequestException(
          `${t.groupCount} groups need at least ${t.groupCount * 2} teams`,
        );
      }
      const minGroupSize = Math.floor(teams.length / t.groupCount);
      if (t.advancePerGroup > minGroupSize) {
        throw new BadRequestException(
          `Groups have ${minGroupSize} teams; at most ${minGroupSize} can advance`,
        );
      }
      if (t.groupCount * t.advancePerGroup < 2) {
        throw new BadRequestException(
          'At least 2 teams must advance to the knockout',
        );
      }
    }

    await this.prisma.$transaction(
      async (tx) => {
        await this.clearDraw(tx, id);
        if (t.format === TournamentFormat.SINGLE_ELIMINATION) {
          await buildKnockout(tx, id, ordered, t.thirdPlaceMatch);
        } else {
          const groups =
            t.format === TournamentFormat.ROUND_ROBIN
              ? [ordered]
              : snakeGroups(ordered, t.groupCount);
          for (const [index, teamIds] of groups.entries()) {
            await buildGroup(
              tx,
              id,
              String.fromCharCode(65 + index),
              index,
              teamIds,
            );
          }
        }
        await tx.tournament.update({
          where: { id },
          data: { status: TournamentStatus.ONGOING },
        });
      },
      { timeout: 30_000 },
    );
    return this.detail(id);
  }

  /** Removes groups and matches (only while no real result exists) and reopens registration. */
  async resetDraw(user: AuthUser, id: string): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    if (t.status !== TournamentStatus.ONGOING)
      throw new ConflictException('There is no draw to reset');
    const played = await this.prisma.tournamentMatch.count({
      where: { tournamentId: id, status: { in: FINISHED } },
    });
    if (played > 0)
      throw new ConflictException(
        'Results have been entered; clear them before resetting the draw',
      );
    await this.prisma.$transaction(async (tx) => {
      await this.clearDraw(tx, id);
      await tx.tournament.update({
        where: { id },
        data: { status: TournamentStatus.REGISTRATION, championTeamId: null },
      });
    });
    return this.detail(id);
  }

  /** Groups + knockout: seeds the bracket from the final group standings. */
  async generateKnockout(
    user: AuthUser,
    id: string,
  ): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    if (
      t.format !== TournamentFormat.GROUPS_KNOCKOUT ||
      t.status !== TournamentStatus.ONGOING
    ) {
      throw new ConflictException(
        'Knockout can only be generated for an ongoing groups + knockout tournament',
      );
    }
    const detail = await this.detail(id);
    if (detail.matches.some((m) => m.stage === TournamentStage.KNOCKOUT)) {
      throw new ConflictException('The knockout stage already exists');
    }
    const open = detail.matches.filter(
      (m) => m.stage === TournamentStage.GROUP && !isFinished(m.status),
    );
    if (open.length > 0)
      throw new ConflictException(
        `${open.length} group match(es) still need a result`,
      );

    const standings = detail.groups.map((g) =>
      g.standings.map((row) => row.teamId),
    );
    const seeds = qualifierSeeds(standings, t.advancePerGroup);
    await this.prisma.$transaction(
      (tx) => buildKnockout(tx, id, seeds, t.thirdPlaceMatch),
      { timeout: 30_000 },
    );
    return this.detail(id);
  }

  /** Removes the knockout stage of a groups + knockout tournament (no knockout results yet). */
  async resetKnockout(user: AuthUser, id: string): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    if (t.format !== TournamentFormat.GROUPS_KNOCKOUT)
      throw new ConflictException('No separate knockout stage');
    const played = await this.prisma.tournamentMatch.count({
      where: {
        tournamentId: id,
        stage: TournamentStage.KNOCKOUT,
        status: { in: FINISHED },
      },
    });
    if (played > 0)
      throw new ConflictException(
        'Knockout results have been entered; clear them first',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.tournamentMatch.deleteMany({
        where: { tournamentId: id, stage: TournamentStage.KNOCKOUT },
      });
      await tx.tournament.update({
        where: { id },
        data: { status: TournamentStatus.ONGOING, championTeamId: null },
      });
    });
    return this.detail(id);
  }

  // ---- Matches ----

  async schedule(
    user: AuthUser,
    id: string,
    matchId: string,
    dto: ScheduleMatchDto,
  ): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    await this.findMatch(id, matchId);
    if (dto.courtId) {
      const court = await this.prisma.court.findUnique({
        where: { id: dto.courtId },
        select: { clubId: true },
      });
      if (!court || court.clubId !== t.clubId)
        throw new BadRequestException('Court does not belong to this club');
    }
    await this.prisma.tournamentMatch.update({
      where: { id: matchId },
      data: {
        courtId: dto.courtId,
        scheduledAt:
          dto.scheduledAt === undefined
            ? undefined
            : dto.scheduledAt
              ? new Date(dto.scheduledAt)
              : null,
      },
    });
    return this.detail(id);
  }

  /** Records (or corrects) a result; the winner advances and the champion is decided automatically. */
  async recordResult(
    user: AuthUser,
    id: string,
    matchId: string,
    dto: MatchResultDto,
  ): Promise<TournamentDetail> {
    const t = await this.load(user, id);
    if (
      t.status !== TournamentStatus.ONGOING &&
      t.status !== TournamentStatus.COMPLETED
    ) {
      throw new ConflictException(
        'Results can only be entered for a started tournament',
      );
    }
    const m = await this.findMatch(id, matchId);
    if (m.status === TournamentMatchStatus.BYE)
      throw new ConflictException('A bye has no result');
    if (!m.teamAId || !m.teamBId)
      throw new ConflictException('Both teams must be known first');
    if (!dto.sets === !dto.walkover)
      throw new BadRequestException('Provide either sets or walkover');

    let winnerSide: 'A' | 'B';
    let sets: SetScore[] | null = null;
    if (dto.walkover) {
      winnerSide = dto.walkover;
    } else {
      try {
        winnerSide = evaluateSets(dto.sets!, rulesOf(t)).winner;
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }
      sets = dto.sets!.map(({ a, b }) => ({ a, b }));
    }
    const winnerId = winnerSide === 'A' ? m.teamAId : m.teamBId;
    const loserId = winnerSide === 'A' ? m.teamBId : m.teamAId;

    if (m.stage === TournamentStage.GROUP) await this.assertNoKnockout(id);
    if (m.winnerId && m.winnerId !== winnerId)
      await this.assertDownstreamOpen(m);

    await this.prisma.$transaction(async (tx) => {
      await tx.tournamentMatch.update({
        where: { id: matchId },
        data: {
          status: dto.walkover
            ? TournamentMatchStatus.WALKOVER
            : TournamentMatchStatus.COMPLETED,
          sets: sets
            ? (sets as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          winnerId,
        },
      });
      await advance(tx, m, winnerId, loserId);
      await this.updateCompletion(tx, id);
    });
    return this.detail(id);
  }

  async clearResult(
    user: AuthUser,
    id: string,
    matchId: string,
  ): Promise<TournamentDetail> {
    await this.load(user, id);
    const m = await this.findMatch(id, matchId);
    if (!isFinished(m.status))
      throw new ConflictException('This match has no result');
    if (m.stage === TournamentStage.GROUP) await this.assertNoKnockout(id);
    await this.assertDownstreamOpen(m);

    await this.prisma.$transaction(async (tx) => {
      await tx.tournamentMatch.update({
        where: { id: matchId },
        data: {
          status: TournamentMatchStatus.SCHEDULED,
          sets: Prisma.DbNull,
          winnerId: null,
        },
      });
      await advance(tx, m, null, null);
      await this.updateCompletion(tx, id);
    });
    return this.detail(id);
  }

  // ---- Internals ----

  private async load(user: AuthUser, id: string): Promise<Tournament> {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Tournament not found');
    assertClubAccess(user, t.clubId);
    return t;
  }

  private async findMatch(tournamentId: string, matchId: string) {
    const m = await this.prisma.tournamentMatch.findFirst({
      where: { id: matchId, tournamentId },
    });
    if (!m) throw new NotFoundException('Match not found');
    return m;
  }

  private async clearDraw(tx: Tx, id: string) {
    await tx.tournamentMatch.deleteMany({ where: { tournamentId: id } });
    await tx.tournamentTeam.updateMany({
      where: { tournamentId: id },
      data: { groupId: null },
    });
    await tx.tournamentGroup.deleteMany({ where: { tournamentId: id } });
  }

  private async assertNoKnockout(id: string) {
    const knockout = await this.prisma.tournamentMatch.count({
      where: { tournamentId: id, stage: TournamentStage.KNOCKOUT },
    });
    if (knockout > 0) {
      throw new ConflictException(
        'The knockout was built from these standings; reset the knockout first',
      );
    }
  }

  /** A result can only change while the matches it fed into have no result yet. */
  private async assertDownstreamOpen(m: {
    nextMatchId: string | null;
    loserNextMatchId: string | null;
  }) {
    const ids = [m.nextMatchId, m.loserNextMatchId].filter(
      (x): x is string => !!x,
    );
    if (!ids.length) return;
    const played = await this.prisma.tournamentMatch.count({
      where: { id: { in: ids }, status: { in: FINISHED } },
    });
    if (played > 0)
      throw new ConflictException(
        'The next match already has a result; clear it first',
      );
  }

  /** Sets champion and COMPLETED when the last deciding match is done (or undoes it). */
  private async updateCompletion(tx: Tx, id: string) {
    const t = await tx.tournament.findUniqueOrThrow({ where: { id } });
    const matches = await tx.tournamentMatch.findMany({
      where: { tournamentId: id },
    });
    const knockout = matches.filter(
      (m) => m.stage === TournamentStage.KNOCKOUT,
    );
    let championTeamId: string | null = null;
    let done = false;

    if (knockout.length > 0) {
      const final = knockout.find((m) => !m.nextMatchId && !m.isThirdPlace);
      championTeamId = final?.winnerId ?? null;
      done = knockout.every((m) => m.winnerId);
    } else if (
      t.format === TournamentFormat.ROUND_ROBIN &&
      matches.length > 0 &&
      matches.every((m) => m.winnerId)
    ) {
      const detail = await this.detail(id, tx);
      championTeamId = detail.groups[0]?.standings[0]?.teamId ?? null;
      done = true;
    }
    await tx.tournament.update({
      where: { id },
      data: {
        championTeamId: done ? championTeamId : null,
        status: done ? TournamentStatus.COMPLETED : TournamentStatus.ONGOING,
      },
    });
  }

  private async checkPlayers(...ids: (string | null | undefined)[]) {
    for (const userId of ids) {
      if (!userId) continue;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (!user || user.role !== Role.PLAYER)
        throw new BadRequestException('Linked player account not found');
    }
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'turnamen';
    for (;;) {
      const slug = `${base}-${randomBytes(3).toString('hex')}`;
      if (
        !(await this.prisma.tournament.findUnique({
          where: { slug },
          select: { id: true },
        }))
      )
        return slug;
    }
  }

  private async detail(
    id: string,
    db: Tx | PrismaService = this.prisma,
  ): Promise<TournamentDetail> {
    const t: DetailRow = await db.tournament.findUniqueOrThrow({
      where: { id },
      include: detailInclude,
    });
    const rules = rulesOf(t);
    const seedOf = new Map(t.teams.map((team) => [team.id, team.seed]));

    const matches: MatchDto[] = t.matches.map((m) => ({
      id: m.id,
      stage: m.stage,
      groupId: m.groupId,
      round: m.round,
      position: m.position,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      court: m.court,
      scheduledAt: m.scheduledAt?.toISOString() ?? null,
      status: m.status,
      sets: (m.sets as SetScore[] | null) ?? null,
      winnerId: m.winnerId,
      nextMatchId: m.nextMatchId,
      isThirdPlace: m.isThirdPlace,
    }));

    const groups = t.groups.map((g) => {
      const teamIds = t.teams
        .filter((team) => team.groupId === g.id)
        .map((team) => team.id);
      const finished: FinishedMatch[] = matches
        .filter(
          (m) =>
            m.groupId === g.id &&
            isFinished(m.status) &&
            m.winnerId &&
            m.teamAId &&
            m.teamBId,
        )
        .map((m) => ({
          teamAId: m.teamAId!,
          teamBId: m.teamBId!,
          winnerId: m.winnerId!,
          outcome: m.sets ? evaluateSets(m.sets, rules) : null,
        }));
      return {
        id: g.id,
        name: g.name,
        order: g.order,
        standings: computeStandings(
          teamIds,
          finished,
          rules,
          (teamId) => seedOf.get(teamId) ?? null,
        ),
      };
    });

    const real = matches.filter((m) => m.status !== TournamentMatchStatus.BYE);
    return {
      ...toSummary(t, {
        teamCount: t.teams.filter(
          (team) => team.status !== TournamentTeamStatus.WITHDRAWN,
        ).length,
        matchCount: real.length,
        finishedMatchCount: real.filter((m) => isFinished(m.status)).length,
      }),
      teams: t.teams.map((team) => ({
        id: team.id,
        name: team.name,
        player1Name: team.player1Name,
        player2Name: team.player2Name,
        player1Id: team.player1Id,
        player2Id: team.player2Id,
        seed: team.seed,
        status: team.status,
        paid: team.paid,
        note: team.note,
        groupId: team.groupId,
      })),
      groups,
      matches,
      knockoutRounds: Math.max(
        0,
        ...matches
          .filter((m) => m.stage === TournamentStage.KNOCKOUT)
          .map((m) => m.round),
      ),
      championTeamId: t.championTeamId,
    };
  }
}

// ---- Helpers ----

function isFinished(status: string): boolean {
  return (
    status === TournamentMatchStatus.COMPLETED ||
    status === TournamentMatchStatus.WALKOVER
  );
}

function rulesOf(
  t: Pick<Tournament, 'setsToWin' | 'gamesPerSet' | 'superTiebreak'>,
): ScoringRules {
  return {
    setsToWin: t.setsToWin,
    gamesPerSet: t.gamesPerSet,
    superTiebreak: t.superTiebreak,
  };
}

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function assertRosterOpen(t: Tournament) {
  if (
    t.status !== TournamentStatus.DRAFT &&
    t.status !== TournamentStatus.REGISTRATION
  ) {
    throw new ConflictException(
      'Teams are locked once the tournament has started',
    );
  }
}

function checkDates(
  start: string,
  end?: string | null,
  deadline?: string | null,
) {
  if (end && new Date(end) < new Date(start))
    throw new BadRequestException('endDate must be on or after startDate');
  if (deadline && new Date(deadline) > new Date(end ?? start)) {
    throw new BadRequestException(
      'registrationDeadline must be before the tournament ends',
    );
  }
}

/** Optional settings shared by create and update (undefined = unchanged, null = cleared). */
function tournamentData(
  dto: UpdateTournamentDto,
): Prisma.TournamentUpdateInput {
  const date = (v: string | null | undefined) =>
    v === undefined ? undefined : v ? new Date(v) : null;
  return {
    category: dto.category === undefined ? undefined : clean(dto.category),
    description:
      dto.description === undefined ? undefined : clean(dto.description),
    endDate: date(dto.endDate),
    registrationDeadline: date(dto.registrationDeadline),
    maxTeams: dto.maxTeams,
    entryFee: dto.entryFee,
    prizeInfo: dto.prizeInfo === undefined ? undefined : clean(dto.prizeInfo),
    isPublic: dto.isPublic,
    setsToWin: dto.setsToWin,
    gamesPerSet: dto.gamesPerSet,
    superTiebreak: dto.superTiebreak,
    goldenPoint: dto.goldenPoint,
    groupCount: dto.groupCount,
    advancePerGroup: dto.advancePerGroup,
    thirdPlaceMatch: dto.thirdPlaceMatch,
  };
}

function toSummary(
  t: Tournament & {
    club: { id: string; name: string; logoFile: string | null };
    champion: { name: string } | null;
  },
  counts: { teamCount: number; matchCount: number; finishedMatchCount: number },
): TournamentSummary {
  return {
    id: t.id,
    clubId: t.clubId,
    club: { id: t.club.id, name: t.club.name, logoUrl: clubLogoUrl(t.club) },
    slug: t.slug,
    status: t.status,
    name: t.name,
    category: t.category,
    description: t.description,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate?.toISOString() ?? null,
    registrationDeadline: t.registrationDeadline?.toISOString() ?? null,
    format: t.format,
    maxTeams: t.maxTeams,
    entryFee: t.entryFee,
    prizeInfo: t.prizeInfo,
    isPublic: t.isPublic,
    setsToWin: t.setsToWin,
    gamesPerSet: t.gamesPerSet,
    superTiebreak: t.superTiebreak,
    goldenPoint: t.goldenPoint,
    groupCount: t.groupCount,
    advancePerGroup: t.advancePerGroup,
    thirdPlaceMatch: t.thirdPlaceMatch,
    ...counts,
    championName: t.champion?.name ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** One group with a full round-robin schedule. */
async function buildGroup(
  tx: Tx,
  tournamentId: string,
  name: string,
  order: number,
  teamIds: string[],
) {
  const group = await tx.tournamentGroup.create({
    data: { tournamentId, name, order },
  });
  await tx.tournamentTeam.updateMany({
    where: { id: { in: teamIds } },
    data: { groupId: group.id },
  });
  const rounds = roundRobinRounds(teamIds);
  await tx.tournamentMatch.createMany({
    data: rounds.flatMap((pairs, r) =>
      pairs.map(([teamAId, teamBId], i) => ({
        tournamentId,
        stage: TournamentStage.GROUP,
        groupId: group.id,
        round: r + 1,
        position: i + 1,
        teamAId,
        teamBId,
      })),
    ),
  });
}

/**
 * Single-elimination bracket for `seeds` (best first). Byes go to the top seeds and are
 * resolved immediately; winners feed `nextMatchId`, semifinal losers the 3rd-place match.
 */
async function buildKnockout(
  tx: Tx,
  tournamentId: string,
  seeds: string[],
  thirdPlace: boolean,
) {
  const size = nextPowerOfTwo(Math.max(seeds.length, 2));
  const rounds = Math.log2(size);
  const positions = seedPositions(size);
  const ids = new Map<string, string>();
  const third =
    thirdPlace && rounds >= 2
      ? await tx.tournamentMatch.create({
          data: {
            tournamentId,
            stage: TournamentStage.KNOCKOUT,
            round: rounds,
            position: 2,
            isThirdPlace: true,
          },
        })
      : null;

  const created: {
    id: string;
    teamAId: string | null;
    teamBId: string | null;
    nextMatchId: string | null;
    nextSlot: string | null;
  }[] = [];
  for (let r = rounds; r >= 1; r--) {
    const count = size / 2 ** r;
    for (let p = 1; p <= count; p++) {
      const nextMatchId =
        r < rounds ? ids.get(`${r + 1}:${Math.ceil(p / 2)}`)! : null;
      const nextSlot = r < rounds ? (p % 2 === 1 ? 'A' : 'B') : null;
      const teamAId =
        r === 1 ? (seeds[positions[2 * (p - 1)] - 1] ?? null) : null;
      const teamBId =
        r === 1 ? (seeds[positions[2 * (p - 1) + 1] - 1] ?? null) : null;
      const m = await tx.tournamentMatch.create({
        data: {
          tournamentId,
          stage: TournamentStage.KNOCKOUT,
          round: r,
          position: p,
          teamAId,
          teamBId,
          nextMatchId,
          nextSlot,
          ...(third && r === rounds - 1
            ? {
                loserNextMatchId: third.id,
                loserNextSlot: p % 2 === 1 ? 'A' : 'B',
              }
            : {}),
        },
      });
      ids.set(`${r}:${p}`, m.id);
      if (r === 1) created.push(m);
    }
  }

  // Byes: the only team in a first-round match advances straight away.
  for (const m of created) {
    const winnerId =
      m.teamAId && !m.teamBId
        ? m.teamAId
        : !m.teamAId && m.teamBId
          ? m.teamBId
          : null;
    if (!winnerId) continue;
    await tx.tournamentMatch.update({
      where: { id: m.id },
      data: { status: TournamentMatchStatus.BYE, winnerId },
    });
    await advance(
      tx,
      { ...m, loserNextMatchId: null, loserNextSlot: null },
      winnerId,
      null,
    );
  }
}

/** Puts the winner (and a semifinal loser) into the next matches; null clears the slot. */
async function advance(
  tx: Tx,
  m: {
    nextMatchId: string | null;
    nextSlot: string | null;
    loserNextMatchId: string | null;
    loserNextSlot: string | null;
  },
  winnerId: string | null,
  loserId: string | null,
) {
  const slot = (s: string | null) => (s === 'B' ? 'teamBId' : 'teamAId');
  if (m.nextMatchId) {
    await tx.tournamentMatch.update({
      where: { id: m.nextMatchId },
      data: { [slot(m.nextSlot)]: winnerId },
    });
  }
  if (m.loserNextMatchId) {
    await tx.tournamentMatch.update({
      where: { id: m.loserNextMatchId },
      data: { [slot(m.loserNextSlot)]: loserId },
    });
  }
}
