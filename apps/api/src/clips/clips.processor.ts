import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError, type Job } from 'bullmq';
import { ClipStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClipStorage } from './clip-storage.service.js';
import { CLIPS_QUEUE, type ClipJobData } from './clips.constants.js';
import { ClipsService } from './clips.service.js';

/**
 * Fetches a clip from the MediaMTX playback server
 * (GET /get?path=&start=&duration=&format=mp4) and stores it.
 */
@Processor(CLIPS_QUEUE, { concurrency: 2 })
export class ClipsProcessor extends WorkerHost {
  private readonly logger = new Logger(ClipsProcessor.name);
  private readonly playbackUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clips: ClipsService,
    private readonly storage: ClipStorage,
    config: ConfigService,
  ) {
    super();
    this.playbackUrl = config.get(
      'MEDIAMTX_PLAYBACK_URL',
      'http://127.0.0.1:9996',
    );
  }

  async process(job: Job<ClipJobData>): Promise<void> {
    const clip = await this.prisma.clip.findUnique({
      where: { id: job.data.clipId },
      include: { camera: { select: { streamPath: true } } },
    });
    if (!clip) return; // Deleted in the meantime (e.g. session removed).

    await this.clips.setStatus(clip.id, ClipStatus.PROCESSING, { error: null });

    const query = new URLSearchParams({
      path: clip.camera.streamPath,
      start: clip.startAt.toISOString(),
      duration: String(clip.durationSec),
      format: 'mp4',
    });
    const res = await fetch(`${this.playbackUrl}/get?${query}`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok || !res.body) {
      const detail = (await res.text().catch(() => '')).trim().slice(0, 200);
      const message = `Playback server HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
      // 4xx = no recording for that path/range (camera offline, never published): retrying won't help.
      if (res.status >= 400 && res.status < 500) {
        throw new UnrecoverableError(
          `No recording for this time range (camera offline?). ${message}`,
        );
      }
      throw new Error(message);
    }

    const url = await this.storage.save(clip.id, res.body);
    await this.clips.setStatus(clip.id, ClipStatus.READY, { url, error: null });
    this.logger.log(
      `Clip ${clip.id} ready (${clip.camera.streamPath}, ${clip.durationSec}s)`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ClipJobData> | undefined, err: Error) {
    if (!job) return;
    const final =
      err instanceof UnrecoverableError ||
      err.name === 'UnrecoverableError' ||
      job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.warn(
      `Clip ${job.data.clipId} attempt ${job.attemptsMade} failed${final ? ' (final)' : ''}: ${err.message}`,
    );
    await this.clips
      .setStatus(
        job.data.clipId,
        final ? ClipStatus.FAILED : ClipStatus.PENDING,
        {
          error: final ? err.message : null,
        },
      )
      .catch(() => {}); // Clip may have been deleted.
  }
}
