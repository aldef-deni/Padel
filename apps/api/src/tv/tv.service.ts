import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { assertClubAccess, type AuthUser } from '../auth/auth-user.js';
import { ClipsService } from '../clips/clips.service.js';
import { clubLogoUrl } from '../clubs/entities/club.entity.js';
import { ClipStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { TvLinkEntity, TvSnapshotEntity } from './entities/tv.entity.js';
import { verifyTvKey } from './tv-key.js';

const RECENT_CLIPS = 10;

@Injectable()
export class TvService {
  private readonly appPublicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clips: ClipsService,
    private readonly realtime: RealtimeGateway,
    config: ConfigService,
  ) {
    this.appPublicUrl = config
      .get('APP_PUBLIC_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
  }

  async getLink(user: AuthUser, clubId: string): Promise<TvLinkEntity> {
    const club = await this.findClub(user, clubId);
    return { url: club.tvKey ? this.linkUrl(clubId, club.tvKey) : null };
  }

  /** Creates a new key; TVs using the old link stop receiving data. */
  async rotateLink(user: AuthUser, clubId: string): Promise<TvLinkEntity> {
    await this.findClub(user, clubId);
    const tvKey = randomBytes(24).toString('base64url');
    await this.prisma.club.update({ where: { id: clubId }, data: { tvKey } });
    await this.realtime.disconnectTvScreens(clubId);
    return { url: this.linkUrl(clubId, tvKey) };
  }

  /** Initial data for the TV page, authorized by the link key. */
  async snapshot(clubId: string, key: unknown): Promise<TvSnapshotEntity> {
    if (!(await verifyTvKey(this.prisma, clubId, key))) {
      throw new UnauthorizedException('Invalid TV link');
    }
    const [club, courts, cameras, clips] = await Promise.all([
      this.prisma.club.findUniqueOrThrow({ where: { id: clubId } }),
      this.prisma.court.findMany({
        where: { clubId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.camera.findMany({
        where: { court: { clubId } },
        select: { id: true, courtId: true, name: true },
        orderBy: { streamPath: 'asc' },
      }),
      this.prisma.clip.findMany({
        where: { status: ClipStatus.READY, camera: { court: { clubId } } },
        orderBy: { createdAt: 'desc' },
        take: RECENT_CLIPS,
      }),
    ]);
    return {
      club: { id: club.id, name: club.name, logoUrl: clubLogoUrl(club) },
      courts,
      cameras,
      recentClips: clips.map((clip) => this.clips.toEntity(clip)),
    };
  }

  private linkUrl(clubId: string, key: string) {
    return `${this.appPublicUrl}/tv/${clubId}?key=${key}`;
  }

  private async findClub(user: AuthUser, clubId: string) {
    assertClubAccess(user, clubId);
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!club) throw new NotFoundException(`Club ${clubId} not found`);
    return club;
  }
}
