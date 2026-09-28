import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { hashPassword } from '../auth/password.js';
import { normalizePhone } from '../auth/phone.js';
import { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateUserDto,
  ListUsersQuery,
  UpdateUserDto,
} from './dto/user.dto.js';
import {
  ManagedUserEntity,
  UserListResponseEntity,
} from './entities/managed-user.entity.js';

const withClub = { club: { select: { id: true, name: true } } } as const;
type UserRow = Prisma.UserGetPayload<{ include: typeof withClub }>;

/** Identity/role fields after normalization; the shape every role rule is checked on. */
interface Shape {
  role: Role;
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  clubId: string | null;
  isActive: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQuery): Promise<UserListResponseEntity> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const searchWhere: Prisma.UserWhereInput = search
      ? {
          ...(query.clubId ? { clubId: query.clubId } : {}),
          OR: (['name', 'username', 'email', 'phone'] as const).map(
            (field) => ({
              [field]: { contains: search, mode: 'insensitive' as const },
            }),
          ),
        }
      : query.clubId
        ? { clubId: query.clubId }
        : {};
    const where: Prisma.UserWhereInput = {
      ...searchWhere,
      ...(query.role ? { role: query.role } : {}),
    };

    const [items, total, grouped] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: withClub,
        // Admins first, then newest.
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: searchWhere,
        _count: { _all: true },
      }),
    ]);

    const counts = { ALL: 0, SUPER_ADMIN: 0, CLUB_ADMIN: 0, PLAYER: 0 };
    for (const g of grouped) {
      counts[g.role] = g._count._all;
      counts.ALL += g._count._all;
    }
    return { items: items.map(toEntity), total, page, pageSize, counts };
  }

  async get(id: string): Promise<ManagedUserEntity> {
    return toEntity(await this.findRow(id));
  }

  async create(dto: CreateUserDto): Promise<ManagedUserEntity> {
    const shape = normalize(
      {
        role: dto.role,
        name: null,
        username: null,
        email: null,
        phone: null,
        clubId: null,
        isActive: true,
      },
      dto,
    );
    await this.validateShape(shape);
    if (shape.role === Role.PLAYER && dto.password) {
      throw new BadRequestException(
        'Players sign in with OTP; a password is not allowed',
      );
    }
    if (shape.role !== Role.PLAYER && !dto.password) {
      throw new BadRequestException('password is required for admin accounts');
    }

    const user = await this.prisma.user.create({
      data: {
        ...shape,
        passwordHash: dto.password ? await hashPassword(dto.password) : null,
      },
      include: withClub,
    });
    return toEntity(user);
  }

  async update(
    actor: AuthUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<ManagedUserEntity> {
    const existing = await this.findRow(id);
    const shape = normalize(existing, dto);
    await this.validateShape(shape);

    if (actor.id === id) {
      if (shape.role !== existing.role)
        throw new BadRequestException('You cannot change your own role');
      if (!shape.isActive)
        throw new BadRequestException('You cannot deactivate your own account');
    }
    const losesSuperAdmin =
      existing.role === Role.SUPER_ADMIN &&
      existing.isActive &&
      (shape.role !== Role.SUPER_ADMIN || !shape.isActive);
    if (losesSuperAdmin) await this.assertAnotherSuperAdmin(id);

    const isPlayer = shape.role === Role.PLAYER;
    if (isPlayer && dto.password) {
      throw new BadRequestException(
        'Players sign in with OTP; a password is not allowed',
      );
    }
    if (!isPlayer && !existing.passwordHash && !dto.password) {
      throw new BadRequestException(
        'password is required when making this user an admin',
      );
    }

    const password: Prisma.UserUpdateInput = isPlayer
      ? { passwordHash: null }
      : dto.password
        ? // A reset revokes every token issued before (see TokenService).
          {
            passwordHash: await hashPassword(dto.password),
            passwordChangedAt: new Date(),
          }
        : {};

    const { clubId, ...rest } = shape;
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...password,
        club: clubId ? { connect: { id: clubId } } : { disconnect: true },
      },
      include: withClub,
    });
    return toEntity(user);
  }

  async remove(actor: AuthUser, id: string) {
    const user = await this.findRow(id);
    if (actor.id === id)
      throw new BadRequestException('You cannot delete your own account');
    if (user.role === Role.SUPER_ADMIN && user.isActive)
      await this.assertAnotherSuperAdmin(id);

    const clips = await this.prisma.clip.count({
      where: { requestedById: id },
    });
    if (clips > 0) {
      throw new ConflictException(
        `User has ${clips} replay clip(s) and cannot be deleted; deactivate the account instead`,
      );
    }
    await this.prisma.user.delete({ where: { id } });
  }

  private async findRow(id: string): Promise<UserRow> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: withClub,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  /** Role rules that must hold after every create/update. */
  private async validateShape(shape: Shape) {
    if (shape.role === Role.PLAYER) {
      if (!shape.phone)
        throw new BadRequestException('phone is required for players');
      return;
    }
    if (!shape.username && !shape.email) {
      throw new BadRequestException(
        'username or email is required for admin accounts',
      );
    }
    if (shape.role === Role.CLUB_ADMIN) {
      if (!shape.clubId)
        throw new BadRequestException('clubId is required for club admins');
      const club = await this.prisma.club.findUnique({
        where: { id: shape.clubId },
        select: { id: true },
      });
      if (!club) throw new BadRequestException('Club does not exist');
    }
  }

  /** Never leave the platform without an active super admin. */
  private async assertAnotherSuperAdmin(exceptId: string) {
    const others = await this.prisma.user.count({
      where: { role: Role.SUPER_ADMIN, isActive: true, id: { not: exceptId } },
    });
    if (others === 0) {
      throw new ConflictException(
        'Cannot remove or demote the last active super admin',
      );
    }
  }
}

/**
 * Applies a DTO to the current values: undefined keeps a field, null clears it.
 * Usernames/emails are lowercased, phones normalized to E.164, and only club admins keep a club.
 */
function normalize(current: Shape, dto: CreateUserDto | UpdateUserDto): Shape {
  const pick = <K extends keyof Shape>(
    key: K,
    map: (v: NonNullable<Shape[K]>) => Shape[K],
  ): Shape[K] => {
    const value = (dto as Partial<Shape>)[key];
    if (value === undefined) return current[key];
    if (value === null || value === '') return null as Shape[K];
    return map(value as NonNullable<Shape[K]>);
  };

  const phone = pick('phone', (raw) => {
    const normalized = normalizePhone(raw);
    if (!normalized)
      throw new BadRequestException('phone must be a valid phone number');
    return normalized;
  });
  const role = dto.role ?? current.role;
  return {
    role,
    name: pick('name', (v) => v.trim() || null),
    username: pick('username', (v) => v.trim().toLowerCase()),
    email: pick('email', (v) => v.trim().toLowerCase()),
    phone,
    clubId: role === Role.CLUB_ADMIN ? pick('clubId', (v) => v) : null,
    isActive: dto.isActive ?? current.isActive,
  };
}

function toEntity(user: UserRow): ManagedUserEntity {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    clubId: user.clubId,
    club: user.club,
    isActive: user.isActive,
    hasPassword: !!user.passwordHash,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
