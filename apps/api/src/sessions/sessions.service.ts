import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { assertClubAccess, type AuthUser } from '../auth/auth-user.js';
import { ClipsService } from '../clips/clips.service.js';
import { ClipEntity } from '../clips/entities/clip.entity.js';
import type { MySession } from '@padel/shared';
import { clubLogoUrl } from '../clubs/entities/club.entity.js';
import { ClipStatus, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessionAccessService } from './session-access.service.js';
import {
  ActiveSessionResponseEntity,
  JoinSessionResponseEntity,
  SessionEntity,
  SessionQrEntity,
  toSessionEntity,
} from './entities/session.entity.js';

const withPlayerCount = { _count: { select: { players: true } } } as const;

@Injectable()
export class SessionsService {
  private readonly appPublicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SessionAccessService,
    private readonly clips: ClipsService,
    config: ConfigService,
  ) {
    this.appPublicUrl = config
      .get('APP_PUBLIC_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
  }

  /** Starts a session on a court; a court has at most one active session. */
  async start(user: AuthUser, courtId: string): Promise<SessionEntity> {
    const court = await this.assertCourtAccess(user, courtId);
    if (!court.club.isActive) throw new ForbiddenException('Club is disabled');
    const session = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent starts on the same court.
      await tx.$queryRaw`SELECT id FROM "Court" WHERE id = ${courtId} FOR UPDATE`;
      const active = await tx.session.findFirst({
        where: { courtId, endedAt: null },
      });
      if (active)
        throw new ConflictException('Court already has an active session');
      return tx.session.create({
        data: { courtId, qrToken: randomBytes(16).toString('base64url') },
        include: withPlayerCount,
      });
    });
    return toSessionEntity(session);
  }

  async active(
    user: AuthUser,
    courtId: string,
  ): Promise<ActiveSessionResponseEntity> {
    await this.assertCourtAccess(user, courtId);
    const session = await this.prisma.session.findFirst({
      where: { courtId, endedAt: null },
      include: withPlayerCount,
    });
    return { session: session ? toSessionEntity(session) : null };
  }

  async get(user: AuthUser, sessionId: string): Promise<SessionEntity> {
    return toSessionEntity(await this.access.get(user, sessionId));
  }

  async end(user: AuthUser, sessionId: string): Promise<SessionEntity> {
    const session = await this.access.get(user, sessionId);
    if (session.endedAt) return toSessionEntity(session);
    const ended = await this.prisma.session.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
      include: withPlayerCount,
    });
    return toSessionEntity(ended);
  }

  async qr(user: AuthUser, sessionId: string): Promise<SessionQrEntity> {
    const session = await this.access.get(user, sessionId);
    const joinUrl = `${this.appPublicUrl}/join/${session.qrToken}`;
    const svg = await QRCode.toString(joinUrl, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    return { qrToken: session.qrToken, joinUrl, svg };
  }

  /** Player scans the court QR: joins the session if it is still active. */
  async join(
    user: AuthUser,
    qrToken: string,
  ): Promise<JoinSessionResponseEntity> {
    const session = await this.prisma.session.findUnique({
      where: { qrToken },
      include: {
        court: {
          select: {
            id: true,
            name: true,
            club: { select: { id: true, name: true, isActive: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.endedAt) throw new GoneException('Session has ended');
    if (!session.court.club.isActive)
      throw new ForbiddenException('Club is disabled');

    // Joining makes the player a club member (visible to the club admin) unless blocked there.
    const clubId = session.court.club.id;
    const membership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: user.id } },
    });
    if (membership?.isBlocked) {
      throw new ForbiddenException('You are blocked at this club');
    }
    if (!membership) {
      // upsert: two quick joins by the same player must not collide.
      await this.prisma.clubMember.upsert({
        where: { clubId_userId: { clubId, userId: user.id } },
        update: {},
        create: { clubId, userId: user.id },
      });
    }

    await this.prisma.sessionPlayer.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
      update: {},
      create: { sessionId: session.id, userId: user.id },
    });
    const playerCount = await this.prisma.sessionPlayer.count({
      where: { sessionId: session.id },
    });
    return {
      session: toSessionEntity({
        ...session,
        _count: { players: playerCount },
      }),
      court: { id: session.court.id, name: session.court.name },
      club: { id: session.court.club.id, name: session.court.club.name },
    };
  }

  /** The replay button: clips of the last `durationSec` seconds from every active camera. */
  async requestReplay(
    user: AuthUser,
    sessionId: string,
    durationSec = 30,
  ): Promise<ClipEntity[]> {
    const session = await this.access.get(user, sessionId);
    if (session.endedAt) throw new ConflictException('Session has ended');
    if (!session.court.club.isActive)
      throw new ForbiddenException('Club is disabled');
    if (user.role === Role.PLAYER) {
      const membership = await this.prisma.clubMember.findUnique({
        where: {
          clubId_userId: { clubId: session.court.clubId, userId: user.id },
        },
      });
      if (membership?.isBlocked) {
        throw new ForbiddenException('You are blocked at this club');
      }
    }
    return this.clips.createReplay(session, user.id, durationSec);
  }

  /** Player history: sessions the user joined, newest first, with clip counts. */
  async mySessions(user: AuthUser, limit = 50): Promise<MySession[]> {
    const joined = await this.prisma.sessionPlayer.findMany({
      where: { userId: user.id },
      orderBy: { session: { startedAt: 'desc' } },
      take: limit,
      select: {
        session: {
          include: {
            ...withPlayerCount,
            court: {
              select: {
                id: true,
                name: true,
                club: { select: { id: true, name: true, logoFile: true } },
              },
            },
          },
        },
      },
    });
    const ids = joined.map((j) => j.session.id);
    const counts = await this.prisma.clip.groupBy({
      by: ['sessionId', 'status'],
      where: { sessionId: { in: ids } },
      _count: { _all: true },
      _max: { createdAt: true },
    });
    return joined.map(({ session }) => {
      const mine = counts.filter((c) => c.sessionId === session.id);
      const last = mine
        .map((c) => c._max.createdAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const { club, ...court } = session.court;
      return {
        session: toSessionEntity(session),
        court,
        club: { id: club.id, name: club.name, logoUrl: clubLogoUrl(club) },
        clips: {
          total: mine.reduce((sum, c) => sum + c._count._all, 0),
          ready: mine
            .filter((c) => c.status === ClipStatus.READY)
            .reduce((sum, c) => sum + c._count._all, 0),
        },
        lastClipAt: last?.toISOString() ?? null,
      };
    });
  }

  async listClips(user: AuthUser, sessionId: string): Promise<ClipEntity[]> {
    await this.access.get(user, sessionId);
    return this.clips.listForSession(sessionId);
  }

  private async assertCourtAccess(user: AuthUser, courtId: string) {
    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
      select: { clubId: true, club: { select: { isActive: true } } },
    });
    if (!court) throw new NotFoundException(`Court ${courtId} not found`);
    assertClubAccess(user, court.clubId);
    return court;
  }
}
