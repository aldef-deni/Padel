import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCameraDto } from './dto/create-camera.dto.js';
import { ListCamerasQuery } from './dto/list-cameras.query.js';
import { UpdateCameraDto } from './dto/update-camera.dto.js';

@Injectable()
export class CamerasService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCameraDto) {
    return this.prisma.camera.create({ data: dto });
  }

  findAll(query: ListCamerasQuery) {
    return this.prisma.camera.findMany({
      where: { courtId: query.courtId },
      orderBy: { streamPath: 'asc' },
    });
  }

  async findOne(id: string) {
    const camera = await this.prisma.camera.findUnique({ where: { id } });
    if (!camera) throw new NotFoundException(`Camera ${id} not found`);
    return camera;
  }

  update(id: string, dto: UpdateCameraDto) {
    return this.prisma.camera.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.camera.delete({ where: { id } });
  }
}
