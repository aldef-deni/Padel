import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { normalizePhone } from '../auth/phone.js';
import { ClipStatus, Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClubDto, ListClubsQuery } from './dto/create-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';
import { ClubOverviewEntity } from './entities/club-overview.entity.js';
import {
  ClubEntity,
  ClubListResponseEntity,
  toClubEntity,
} from './entities/club.entity.js';
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
    const data = normalizeClubInput(dto) as Prisma.ClubCreateInput;
    return toClubEntity(await this.prisma.club.create({ data }));
  }

  /** SUPER_ADMIN list: search, status filter, pagination and per-club stats. */
  async listWithStats(query: ListClubsQuery): Promise<ClubListResponseEntity> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 12;
    const search = query.search?.trim();
    const searchWhere: Prisma.ClubWhereInput = search
      ? {
          OR: (['name', 'slug', 'city'] as const).map((field) => ({
            [field]: { contains: search, mode: 'insensitive' as const },
          })),
        }
      : {};
    const where: Prisma.ClubWhereInput = {
      ...searchWhere,
      ...(query.status ? { isActive: query.status === 'ACTIVE' } : {}),
    };

    const [clubs, total, grouped] = await Promise.all([
      this.prisma.club.findMany({
        where,
        include: {
          _count: {
            select: {
              courts: true,
              admins: { where: { role: Role.CLUB_ADMIN } },
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.club.count({ where }),
      this.prisma.club.groupBy({
        by: ['isActive'],
        where: searchWhere,
        _count: { _all: true },
      }),
    ]);

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const items = await Promise.all(
      clubs.map(async ({ _count, ...club }) => {
        const [cameras, activeSessions, clips30d] = await Promise.all([
          this.prisma.camera.count({ where: { court: { clubId: club.id } } }),
          this.prisma.session.count({
            where: { endedAt: null, court: { clubId: club.id } },
          }),
          this.prisma.clip.count({
            where: {
              createdAt: { gte: since },
              camera: { court: { clubId: club.id } },
            },
          }),
        ]);
        return Object.assign(toClubEntity(club), {
          stats: {
            courts: _count.courts,
            cameras,
            admins: _count.admins,
            activeSessions,
            clips30d,
          },
        });
      }),
    );

    const counts = { ALL: 0, ACTIVE: 0, INACTIVE: 0 };
    for (const g of grouped) {
      counts[g.isActive ? 'ACTIVE' : 'INACTIVE'] = g._count._all;
      counts.ALL += g._count._all;
    }
    return { items, total, page, pageSize, counts };
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
    // A club admin can edit the profile but not (re)activate their own club.
    if (dto.isActive !== undefined && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Only a super admin can change the club status',
      );
    }
    return toClubEntity(
      await this.prisma.club.update({
        where: { id },
        data: normalizeClubInput(dto),
      }),
    );
  }

  /** Only empty clubs can be deleted; otherwise deactivate. */
  async remove(id: string) {
    const club = await this.prisma.club.findUnique({
      where: { id },
      include: { _count: { select: { courts: true, admins: true } } },
    });
    if (!club) throw new NotFoundException(`Club ${id} not found`);
    if (club._count.courts > 0 || club._count.admins > 0) {
      throw new ConflictException(
        `Club still has ${club._count.courts} court(s) and ${club._count.admins} admin(s); remove them first or deactivate the club`,
      );
    }
    await this.prisma.club.delete({ where: { id } });
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

const NULLABLE = [
  'address',
  'city',
  'description',
  'phone',
  'email',
  'website',
  'instagram',
  'mapsUrl',
  'openTime',
  'closeTime',
] as const;

/**
 * Trims text, turns "" into null, normalizes the phone to E.164, lowercases the email and
 * reduces Instagram input ("@user", profile URL) to the bare username.
 */
function normalizeClubInput(dto: UpdateClubDto): Prisma.ClubUpdateInput {
  const data = Object.assign({}, dto) as Record<string, unknown>;
  if (typeof dto.name === 'string') data.name = dto.name.trim();
  for (const key of NULLABLE) {
    const value = dto[key];
    if (typeof value === 'string') data[key] = value.trim() || null;
  }
  if (typeof data.phone === 'string') {
    const phone = normalizePhone(data.phone);
    if (!phone)
      throw new BadRequestException('phone must be a valid phone number');
    data.phone = phone;
  }
  if (typeof data.email === 'string') data.email = data.email.toLowerCase();
  if (typeof data.instagram === 'string') {
    const handle = data.instagram
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/^@/, '')
      .replace(/[/?#].*$/, '');
    if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
      throw new BadRequestException(
        'instagram must be a username or profile URL',
      );
    }
    data.instagram = handle;
  }
  return data as Prisma.ClubUpdateInput;
}
