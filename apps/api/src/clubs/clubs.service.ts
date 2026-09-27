import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClubDto } from './dto/create-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';

@Injectable()
export class ClubsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClubDto) {
    return this.prisma.club.create({ data: dto });
  }

  findAll() {
    return this.prisma.club.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const club = await this.prisma.club.findUnique({ where: { id } });
    if (!club) throw new NotFoundException(`Club ${id} not found`);
    return club;
  }

  update(id: string, dto: UpdateClubDto) {
    return this.prisma.club.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.club.delete({ where: { id } });
  }
}
