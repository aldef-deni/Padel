import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  assertClubAccess,
  clubScope,
  type AuthUser,
} from '../auth/auth-user.js';
import { ClipsService } from '../clips/clips.service.js';
import { startOfDayIn } from '../common/time.js';
import { ClipStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClubDto } from './dto/create-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';
import { ClubOverviewEntity } from './entities/club-overview.entity.js';
import { ClubEntity, toClubEntity } from './entities/club.entity.js';
import {
  detectLogoType,
  LOGO_CONTENT_TYPES,
  LogoStorage,
  type LogoType,
} from './logo-storage.service.js';

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logos: LogoStorage,
    private readonly clips: ClipsService,
  ) {}

  async create(dto: CreateClubDto): Promise<ClubEntity> {
    return toClubEntity(await this.prisma.club.create({ data: dto }));
  }

  async findAll(user: AuthUser): Promise<ClubEntity[]> {
    const clubs = await this.prisma.club.findMany({
      where: { id: clubScope(user) },
      orderBy: { name: 'asc' },
    });
    return clubs.map(toClubEntity);
  }

  async findOne(user: AuthUser, id: string): Promise<ClubEntity> {
    assertClubAccess(user, id);
    const club = await this.prisma.club.findUnique({ where: { id } });
    if (!club) throw new NotFoundException(`Club ${id} not found`);
    return toClubEntity(club);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateClubDto,
  ): Promise<ClubEntity> {
    assertClubAccess(user, id);
    return toClubEntity(
      await this.prisma.club.update({ where: { id }, data: dto }),
    );
  }

  async remove(id: string) {
    const club = await this.prisma.club.delete({ where: { id } });
    if (club.logoFile) await this.logos.remove(club.logoFile);
  }

  /** Dashboard numbers: active sessions, today's replays, latest clips. */
  async overview(user: AuthUser, id: string): Promise<ClubOverviewEntity> {
    const club = await this.findRow(user, id);
    const inClub = { camera: { court: { clubId: id } } };
    const [sessions, counts, recent] = await Promise.all([
      this.prisma.session.findMany({
        where: { endedAt: null, court: { clubId: id } },
        include: { _count: { select: { players: true } } },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.clip.groupBy({
        by: ['status'],
        where: { ...inClub, createdAt: { gte: startOfDayIn(club.timezone) } },
        _count: { _all: true },
      }),
      this.prisma.clip.findMany({
        where: inClub,
        include: {
          camera: {
            select: { name: true, court: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const count = (status?: ClipStatus) =>
      counts
        .filter((c) => !status || c.status === status)
        .reduce((sum, c) => sum + c._count._all, 0);

    return {
      activeSessions: sessions.map((s) => ({
        sessionId: s.id,
        courtId: s.courtId,
        startedAt: s.startedAt.toISOString(),
        playerCount: s._count.players,
      })),
      clipsToday: {
        total: count(),
        ready: count(ClipStatus.READY),
        failed: count(ClipStatus.FAILED),
      },
      recentClips: recent.map(({ camera, ...clip }) =>
        Object.assign(this.clips.toEntity(clip), {
          courtId: camera.court.id,
          courtName: camera.court.name,
          cameraName: camera.name,
        }),
      ),
    };
  }

  async setLogo(
    user: AuthUser,
    id: string,
    data: Buffer | undefined,
  ): Promise<ClubEntity> {
    const club = await this.findRow(user, id);
    if (!data?.length) throw new BadRequestException('file is required');
    const type = detectLogoType(data);
    if (!type)
      throw new BadRequestException('Logo must be a PNG, JPEG or WebP image');

    const logoFile = await this.logos.save(id, data, type);
    const updated = await this.prisma.club.update({
      where: { id },
      data: { logoFile },
    });
    if (club.logoFile) await this.logos.remove(club.logoFile);
    return toClubEntity(updated);
  }

  async removeLogo(user: AuthUser, id: string) {
    const club = await this.findRow(user, id);
    if (!club.logoFile) return;
    await this.prisma.club.update({ where: { id }, data: { logoFile: null } });
    await this.logos.remove(club.logoFile);
  }

  /** Public: logos are shown on TV screens without a login. */
  async logoFile(id: string): Promise<{ path: string; contentType: string }> {
    const club = await this.prisma.club.findUnique({
      where: { id },
      select: { logoFile: true },
    });
    if (!club?.logoFile) throw new NotFoundException('Club has no logo');
    const ext = club.logoFile.split('.').pop() as LogoType;
    return {
      path: this.logos.filePath(club.logoFile),
      contentType: LOGO_CONTENT_TYPES[ext],
    };
  }

  private async findRow(user: AuthUser, id: string) {
    assertClubAccess(user, id);
    const club = await this.prisma.club.findUnique({ where: { id } });
    if (!club) throw new NotFoundException(`Club ${id} not found`);
    return club;
  }
}
