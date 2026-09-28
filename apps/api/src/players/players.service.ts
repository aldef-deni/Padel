import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertClubAccess, type AuthUser } from '../auth/auth-user.js';
import { normalizePhone } from '../auth/phone.js';
import { Prisma, Role } from '../generated/prisma/client.js';
import { userAvatarUrl } from '../common/avatar-url.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreatePlayerDto,
  ListPlayersQuery,
  UpdatePlayerDto,
} from './dto/player.dto.js';
import {
  ClubPlayerEntity,
  ClubPlayerListResponseEntity,
  CreateClubPlayerResponseEntity,
} from './entities/club-player.entity.js';

const withUser = { user: true } as const;
type MemberRow = Prisma.ClubMemberGetPayload<{ include: typeof withUser }>;

/**
 * Players of one club. PLAYER accounts are global (a player may play at many clubs);
 * ClubMember decides which players a club admin manages. Removing a player only ends the
 * membership, the account and its history stay.
 */
@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthUser,
    clubId: string,
    query: ListPlayersQuery,
  ): Promise<ClubPlayerListResponseEntity> {
    await this.assertClub(actor, clubId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const base: Prisma.ClubMemberWhereInput = {
      clubId,
      user: {
        role: Role.PLAYER,
        ...(search
          ? {
              OR: (['name', 'phone', 'email'] as const).map((field) => ({
                [field]: { contains: search, mode: 'insensitive' as const },
              })),
            }
          : {}),
      },
    };
    const where: Prisma.ClubMemberWhereInput = {
      ...base,
      ...(query.status ? { isBlocked: query.status === 'BLOCKED' } : {}),
    };

    const [members, total, grouped] = await Promise.all([
      this.prisma.clubMember.findMany({
        where,
        include: withUser,
        orderBy: [{ isBlocked: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.clubMember.count({ where }),
      this.prisma.clubMember.groupBy({
        by: ['isBlocked'],
        where: base,
        _count: { _all: true },
      }),
    ]);

    const counts = { ALL: 0, ACTIVE: 0, BLOCKED: 0 };
    for (const g of grouped) {
      counts[g.isBlocked ? 'BLOCKED' : 'ACTIVE'] = g._count._all;
      counts.ALL += g._count._all;
    }
    const items = await Promise.all(members.map((m) => this.toEntity(m)));
    return { items, total, page, pageSize, counts };
  }

  /**
   * Adds a player by phone and/or email; an existing PLAYER account with that phone or
   * email is linked instead of duplicated.
   */
  async create(
    actor: AuthUser,
    clubId: string,
    dto: CreatePlayerDto,
  ): Promise<CreateClubPlayerResponseEntity> {
    await this.assertClub(actor, clubId);
    const phone = clean(dto.phone) ? parsePhone(dto.phone!) : null;
    const email = cleanEmail(dto.email);
    if (!phone && !email)
      throw new BadRequestException('phone or email is required');

    const [byPhone, byEmail] = await Promise.all([
      phone ? this.prisma.user.findUnique({ where: { phone } }) : null,
      email ? this.prisma.user.findUnique({ where: { email } }) : null,
    ]);
    if (byPhone && byEmail && byPhone.id !== byEmail.id) {
      throw new ConflictException(
        'Phone and email belong to different accounts',
      );
    }
    const existing = byPhone ?? byEmail;

    if (existing) {
      if (existing.role !== Role.PLAYER) {
        throw new ConflictException(
          'This phone number or email belongs to an admin account',
        );
      }
      const member = await this.prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId: existing.id } },
      });
      if (member)
        throw new ConflictException('Player is already a member of this club');
      // Fill in what the account lacks, never overwrite what the player already has.
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: existing.name ?? clean(dto.name),
          email: existing.email ?? email,
          phone: existing.phone ?? phone,
        },
      });
    }

    const userId =
      existing?.id ??
      (
        await this.prisma.user.create({
          data: { phone, email, role: Role.PLAYER, name: clean(dto.name) },
        })
      ).id;
    const member = await this.prisma.clubMember.create({
      data: { clubId, userId, note: clean(dto.note) },
      include: withUser,
    });
    return { player: await this.toEntity(member), existingAccount: !!existing };
  }

  async update(
    actor: AuthUser,
    clubId: string,
    userId: string,
    dto: UpdatePlayerDto,
  ): Promise<ClubPlayerEntity> {
    const current = await this.findMember(actor, clubId, userId);
    const user: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) user.name = clean(dto.name);
    if (dto.email !== undefined) user.email = cleanEmail(dto.email);
    if (dto.phone !== undefined)
      user.phone = clean(dto.phone) ? parsePhone(dto.phone!) : null;

    const phone = dto.phone === undefined ? current.user.phone : user.phone;
    const email = dto.email === undefined ? current.user.email : user.email;
    if (!phone && !email)
      throw new BadRequestException('phone or email is required');

    const member = await this.prisma.clubMember.update({
      where: { clubId_userId: { clubId, userId } },
      data: {
        ...(dto.note !== undefined ? { note: clean(dto.note) } : {}),
        ...(dto.isBlocked !== undefined ? { isBlocked: dto.isBlocked } : {}),
        ...(Object.keys(user).length ? { user: { update: user } } : {}),
      },
      include: withUser,
    });
    return this.toEntity(member);
  }

  /** Ends the membership; the account and its replay history remain. */
  async remove(actor: AuthUser, clubId: string, userId: string) {
    await this.findMember(actor, clubId, userId);
    await this.prisma.clubMember.delete({
      where: { clubId_userId: { clubId, userId } },
    });
  }

  private async assertClub(actor: AuthUser, clubId: string) {
    assertClubAccess(actor, clubId);
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true },
    });
    if (!club) throw new NotFoundException(`Club ${clubId} not found`);
  }

  private async findMember(actor: AuthUser, clubId: string, userId: string) {
    await this.assertClub(actor, clubId);
    const member = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: withUser,
    });
    if (!member || member.user.role !== Role.PLAYER) {
      throw new NotFoundException('Player is not a member of this club');
    }
    return member;
  }

  private async toEntity(member: MemberRow): Promise<ClubPlayerEntity> {
    const atClub = { court: { clubId: member.clubId } };
    const [sessionsCount, clipsCount, last] = await Promise.all([
      this.prisma.sessionPlayer.count({
        where: { userId: member.userId, session: atClub },
      }),
      this.prisma.clip.count({
        where: { requestedById: member.userId, camera: atClub },
      }),
      this.prisma.sessionPlayer.findFirst({
        where: { userId: member.userId, session: atClub },
        orderBy: { joinedAt: 'desc' },
        select: { joinedAt: true },
      }),
    ]);
    const { user } = member;
    return {
      id: user.id,
      name: user.name,
      avatarUrl: userAvatarUrl(user),
      phone: user.phone,
      email: user.email,
      accountActive: user.isActive,
      isBlocked: member.isBlocked,
      note: member.note,
      joinedAt: member.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      sessionsCount,
      clipsCount,
      lastPlayedAt: last?.joinedAt.toISOString() ?? null,
    };
  }
}

function parsePhone(raw: string): string {
  const phone = normalizePhone(raw);
  if (!phone)
    throw new BadRequestException('phone must be a valid phone number');
  return phone;
}

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function cleanEmail(value: string | null | undefined): string | null {
  return clean(value)?.toLowerCase() ?? null;
}
