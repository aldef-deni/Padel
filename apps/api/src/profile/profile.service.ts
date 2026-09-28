import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toUserEntity } from '../auth/auth.service.js';
import { UserEntity } from '../auth/dto/auth.entities.js';
import { normalizePhone } from '../auth/phone.js';
import {
  detectLogoType,
  LOGO_CONTENT_TYPES,
  type LogoType,
} from '../clubs/logo-storage.service.js';
import { Role, type Prisma } from '../generated/prisma/client.js';
import { DemoService } from '../demo/demo.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AvatarStorage } from './avatar-storage.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarStorage,
    private readonly demo: DemoService,
  ) {}

  async update(userId: string, dto: UpdateProfileDto): Promise<UserEntity> {
    const user = await this.find(userId);
    // Username/email are the demo account's login: keep them stable for every visitor.
    if (dto.username !== undefined || dto.email !== undefined)
      await this.demo.assertNotDemoAccount(userId);
    const data: Prisma.UserUpdateInput = {};
    const clean = (v: string | null | undefined) => v?.trim() || null;

    if (dto.name !== undefined) data.name = clean(dto.name);
    if (dto.username !== undefined)
      data.username = clean(dto.username)?.toLowerCase() ?? null;
    if (dto.email !== undefined) {
      // A player's email is their login; changing it needs a verification code, not a form.
      if (user.role === Role.PLAYER) {
        throw new BadRequestException(
          'Players change their email through a verification code',
        );
      }
      data.email = clean(dto.email)?.toLowerCase() ?? null;
    }
    if (dto.phone !== undefined) {
      // A player's phone is their login; changing it needs an OTP flow, not a form.
      if (user.role === Role.PLAYER) {
        throw new BadRequestException(
          'Players change their phone number through OTP',
        );
      }
      const raw = clean(dto.phone);
      const phone = raw ? normalizePhone(raw) : null;
      if (raw && !phone)
        throw new BadRequestException('phone must be a valid phone number');
      data.phone = phone;
    }

    if (user.role !== Role.PLAYER) {
      const username =
        data.username === undefined ? user.username : data.username;
      const email = data.email === undefined ? user.email : data.email;
      if (!username && !email) {
        throw new BadRequestException(
          'username or email is required for admin accounts',
        );
      }
    }
    return toUserEntity(
      await this.prisma.user.update({ where: { id: userId }, data }),
    );
  }

  async setAvatar(
    userId: string,
    file: Buffer | undefined,
  ): Promise<UserEntity> {
    const user = await this.find(userId);
    if (!file?.length) throw new BadRequestException('file is required');
    const type = detectLogoType(file);
    if (!type)
      throw new BadRequestException('Avatar must be a PNG, JPEG or WebP image');

    const avatarFile = await this.avatars.save(userId, file, type);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarFile },
    });
    await this.avatars.remove(user.avatarFile);
    return toUserEntity(updated);
  }

  async removeAvatar(userId: string): Promise<UserEntity> {
    const user = await this.find(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarFile: null },
    });
    await this.avatars.remove(user.avatarFile);
    return toUserEntity(updated);
  }

  /** Public: avatars are shown next to names (and later in the player app). */
  async avatarFile(
    userId: string,
  ): Promise<{ path: string; contentType: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarFile: true },
    });
    if (!user?.avatarFile) throw new NotFoundException('User has no avatar');
    const ext = user.avatarFile.split('.').pop() as LogoType;
    return {
      path: this.avatars.filePath(user.avatarFile),
      contentType: LOGO_CONTENT_TYPES[ext],
    };
  }

  private async find(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    return user;
  }
}
