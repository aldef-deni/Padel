import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  assertClubAccess,
  clubScope,
  type AuthUser,
} from '../auth/auth-user.js';
import { MediamtxService } from '../media/mediamtx.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CameraStatusResponseEntity } from './entities/camera-status.entity.js';
import { CreateCameraDto } from './dto/create-camera.dto.js';
import { ListCamerasQuery } from './dto/list-cameras.query.js';
import { UpdateCameraDto } from './dto/update-camera.dto.js';

@Injectable()
export class CamerasService {
  /** Matches recordDeleteAfter in infra/mediamtx/mediamtx.yml. */
  private readonly recordRetentionHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediamtx: MediamtxService,
    config: ConfigService,
  ) {
    this.recordRetentionHours = Number(
      config.get('MEDIAMTX_RECORD_RETENTION_HOURS', 2),
    );
  }

  async create(user: AuthUser, dto: CreateCameraDto) {
    await this.assertCourtAccess(user, dto.courtId);
    return this.prisma.camera.create({ data: dto });
  }

  findAll(user: AuthUser, query: ListCamerasQuery) {
    return this.prisma.camera.findMany({
      where: {
        courtId: query.courtId,
        court: { AND: [{ clubId: clubScope(user) }, { clubId: query.clubId }] },
      },
      orderBy: { streamPath: 'asc' },
    });
  }

  /** Live status of the cameras the user can see, from MediaMTX. */
  async status(
    user: AuthUser,
    query: ListCamerasQuery,
  ): Promise<CameraStatusResponseEntity> {
    const [cameras, paths, recordings] = await Promise.all([
      this.findAll(user, query),
      this.mediamtx.getPaths(),
      this.mediamtx.getRecordings(),
    ]);
    return {
      mediaServerReachable: paths !== null,
      recordRetentionHours: this.recordRetentionHours,
      cameras: cameras.map((camera) => {
        const path = paths?.get(camera.streamPath);
        const recorded = recordings?.get(camera.streamPath);
        return {
          cameraId: camera.id,
          streamPath: camera.streamPath,
          online: path?.online ?? false,
          onlineSince: path?.online ? path.onlineSince : null,
          tracks: path?.tracks ?? [],
          video: path?.video ?? null,
          bytesReceived: path?.bytesReceived ?? 0,
          readers: path?.readers ?? 0,
          recording: {
            active: path?.online ?? false,
            availableFrom: recorded?.availableFrom ?? null,
            segments: recorded?.segments ?? 0,
          },
        };
      }),
    };
  }

  async findOne(user: AuthUser, id: string) {
    const found = await this.prisma.camera.findUnique({
      where: { id },
      include: { court: { select: { clubId: true } } },
    });
    if (!found) throw new NotFoundException(`Camera ${id} not found`);
    const { court, ...camera } = found;
    assertClubAccess(user, court.clubId);
    return camera;
  }

  async update(user: AuthUser, id: string, dto: UpdateCameraDto) {
    await this.findOne(user, id);
    if (dto.courtId) await this.assertCourtAccess(user, dto.courtId);
    return this.prisma.camera.update({ where: { id }, data: dto });
  }

  async remove(user: AuthUser, id: string) {
    await this.findOne(user, id);
    await this.prisma.camera.delete({ where: { id } });
  }

  /** A missing court is left to the FK constraint (400 via PrismaExceptionFilter). */
  private async assertCourtAccess(user: AuthUser, courtId: string) {
    const court = await this.prisma.court.findUnique({
      where: { id: courtId },
      select: { clubId: true },
    });
    if (court) assertClubAccess(user, court.clubId);
  }
}
