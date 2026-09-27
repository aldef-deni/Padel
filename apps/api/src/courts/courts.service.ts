import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCourtDto } from './dto/create-court.dto.js';
import { ListCourtsQuery } from './dto/list-courts.query.js';
import { UpdateCourtDto } from './dto/update-court.dto.js';

@Injectable()
export class CourtsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCourtDto) {
    return this.prisma.court.create({ data: dto });
  }

  findAll(query: ListCourtsQuery) {
    return this.prisma.court.findMany({
      where: { clubId: query.clubId },
      orderBy: [{ clubId: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const court = await this.prisma.court.findUnique({ where: { id } });
    if (!court) throw new NotFoundException(`Court ${id} not found`);
    return court;
  }

  update(id: string, dto: UpdateCourtDto) {
    return this.prisma.court.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.court.delete({ where: { id } });
  }
}
