import { Injectable, NotFoundException } from '@nestjs/common';
import {
  assertClubAccess,
  clubScope,
  type AuthUser,
} from '../auth/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCourtDto } from './dto/create-court.dto.js';
import { ListCourtsQuery } from './dto/list-courts.query.js';
import { UpdateCourtDto } from './dto/update-court.dto.js';

@Injectable()
export class CourtsService {
  constructor(private readonly prisma: PrismaService) {}

  create(user: AuthUser, dto: CreateCourtDto) {
    assertClubAccess(user, dto.clubId);
    return this.prisma.court.create({ data: dto });
  }

  findAll(user: AuthUser, query: ListCourtsQuery) {
    return this.prisma.court.findMany({
      where: { AND: [{ clubId: clubScope(user) }, { clubId: query.clubId }] },
      orderBy: [{ clubId: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(user: AuthUser, id: string) {
    const court = await this.prisma.court.findUnique({ where: { id } });
    if (!court) throw new NotFoundException(`Court ${id} not found`);
    assertClubAccess(user, court.clubId);
    return court;
  }

  async update(user: AuthUser, id: string, dto: UpdateCourtDto) {
    await this.findOne(user, id);
    return this.prisma.court.update({ where: { id }, data: dto });
  }

  async remove(user: AuthUser, id: string) {
    await this.findOne(user, id);
    await this.prisma.court.delete({ where: { id } });
  }
}
