import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  ClipStatus,
  type Clip,
  type Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import {
  CLIP_JOB_ATTEMPTS,
  CLIP_JOB_DELAY_MS,
  CLIPS_QUEUE,
  type ClipJobData,
} from './clips.constants.js';
import { ClipEntity } from './entities/clip.entity.js';

const DOWNLOAD_URL_TTL_SEC = 60 * 60;

@Injectable()
export class ClipsService {
  private readonly logger = new Logger(ClipsService.name);
  private readonly urlSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    @InjectQueue(CLIPS_QUEUE) private readonly queue: Queue<ClipJobData>,
    config: ConfigService,
  ) {
    this.urlSecret = config.getOrThrow<string>('JWT_SECRET');
  }

  /**
   * Creates one PENDING clip per active camera on the session's court, covering the
   * last `durationSec` seconds, and queues a job to fetch each from MediaMTX.
   */
  async createReplay(
    session: { id: string; courtId: string; court: { clubId: string } },
    requestedById: string,
    durationSec: number,
  ): Promise<ClipEntity[]> {
    const cameras = await this.prisma.camera.findMany({
      where: { courtId: session.courtId, isActive: true },
      orderBy: { streamPath: 'asc' },
    });
    if (cameras.length === 0)
      throw new ConflictException('Court has no active camera');

    const startAt = new Date(Date.now() - durationSec * 1000);
    const clips = await this.prisma.$transaction(
      cameras.map((camera) =>
        this.prisma.clip.create({
          data: {
            sessionId: session.id,
            cameraId: camera.id,
            requestedById,
            startAt,
            durationSec,
          },
        }),
      ),
    );

    const entities: ClipEntity[] = [];
    for (const clip of clips) {
      try {
        await this.queue.add(
          'fetch',
          { clipId: clip.id },
          {
            jobId: clip.id,
            delay: CLIP_JOB_DELAY_MS,
            attempts: CLIP_JOB_ATTEMPTS,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: 1000,
            removeOnFail: 1000,
          },
        );
        entities.push(this.toEntity(clip));
      } catch (err) {
        this.logger.error(
          `Failed to queue clip ${clip.id}: ${(err as Error).message}`,
        );
        entities.push(
          this.toEntity(
            await this.setStatus(clip.id, ClipStatus.FAILED, {
              error: 'Queue unavailable',
            }),
          ),
        );
        continue;
      }
      this.realtime.emitClip(
        entities[entities.length - 1],
        session.court.clubId,
      );
    }
    return entities;
  }

  async listForSession(sessionId: string): Promise<ClipEntity[]> {
    const clips = await this.prisma.clip.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'desc' }, { cameraId: 'asc' }],
    });
    return clips.map((clip) => this.toEntity(clip));
  }

  /** Updates a clip's status and notifies subscribers of its session. */
  async setStatus(
    clipId: string,
    status: ClipStatus,
    data: Omit<Prisma.ClipUpdateInput, 'status'> = {},
  ): Promise<Clip> {
    const { camera, ...clip } = await this.prisma.clip.update({
      where: { id: clipId },
      data: { ...data, status },
      include: { camera: { select: { court: { select: { clubId: true } } } } },
    });
    this.realtime.emitClip(this.toEntity(clip), camera.court.clubId);
    return clip;
  }

  toEntity(clip: Clip): ClipEntity {
    return {
      id: clip.id,
      sessionId: clip.sessionId,
      cameraId: clip.cameraId,
      requestedById: clip.requestedById,
      startAt: clip.startAt.toISOString(),
      durationSec: clip.durationSec,
      status: clip.status,
      error: clip.error,
      downloadUrl:
        clip.status === ClipStatus.READY ? this.signedUrl(clip.id) : null,
      createdAt: clip.createdAt.toISOString(),
      updatedAt: clip.updatedAt.toISOString(),
    };
  }

  /** Time-limited URL so <video> can load the file without an Authorization header. */
  private signedUrl(clipId: string) {
    const exp = Math.floor(Date.now() / 1000) + DOWNLOAD_URL_TTL_SEC;
    return `/api/clips/${clipId}/file?exp=${exp}&sig=${this.sign(clipId, exp)}`;
  }

  verifySignature(
    clipId: string,
    exp: string | undefined,
    sig: string | undefined,
  ): boolean {
    const expSec = Number(exp);
    if (!sig || !Number.isInteger(expSec) || expSec < Date.now() / 1000)
      return false;
    const expected = Buffer.from(this.sign(clipId, expSec));
    const actual = Buffer.from(sig);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private sign(clipId: string, exp: number) {
    return createHmac('sha256', this.urlSecret)
      .update(`clip:${clipId}:${exp}`)
      .digest('base64url');
  }
}
