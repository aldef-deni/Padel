import { Injectable, NotFoundException } from '@nestjs/common';
import {
  assertClubAccess,
  clubScope,
  type AuthUser,
} from '../auth/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClubDto } from './dto/create-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClubDto) {
    return this.prisma.club.create({ data: dto });
  }

  findAll(user: AuthUser) {
    return this.prisma.club.findMany({
      where: { id: clubScope(user) },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    assertClubAccess(user, id);
    const club = await this.prisma.club.findUnique({ where: { id } });
    if (!club) throw new NotFoundException(`Club ${id} not found`);
    return club;
  }

  update(user: AuthUser, id: string, dto: UpdateClubDto) {
    assertClubAccess(user, id);
    return this.prisma.club.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.club.delete({ where: { id } });
  }
}
