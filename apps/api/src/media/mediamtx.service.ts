import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Subset of MediaMTX `GET /v3/paths/list` item fields (v1.21). */
interface MediamtxPath {
  name: string;
  ready: boolean;
  readyTime: string | null;
  online?: boolean;
  onlineTime?: string | null;
  tracks: string[];
  tracks2?: {
    codec: string;
    codecProps?: { width?: number; height?: number };
  }[];
  readers: unknown[];
  inboundBytes?: number;
  bytesReceived?: number;
}

export interface RecordingState {
  /** Start of the oldest segment still on disk. */
  availableFrom: string | null;
  segments: number;
}

export interface PathState {
  online: boolean;
  onlineSince: string | null;
  tracks: string[];
  video: { codec: string; width: number | null; height: number | null } | null;
  bytesReceived: number;
  readers: number;
}

const VIDEO_CODECS = [
  'H264',
  'H265',
  'AV1',
  'VP8',
  'VP9',
  'MPEG-4 Video',
  'M-JPEG',
];

/** Reads live path state from the MediaMTX control API (localhost only). */
@Injectable()
export class MediamtxService {
  private readonly logger = new Logger(MediamtxService.name);
  private readonly apiUrl: string;

  constructor(config: ConfigService) {
    this.apiUrl = config.get('MEDIAMTX_API_URL', 'http://127.0.0.1:9997');
  }

  /** Returns state per path name, or null when MediaMTX is unreachable. */
  async getPaths(): Promise<Map<string, PathState> | null> {
    try {
      const res = await fetch(
        `${this.apiUrl}/v3/paths/list?itemsPerPage=1000`,
        {
          signal: AbortSignal.timeout(2000),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { items: MediamtxPath[] };
      return new Map(body.items.map((p) => [p.name, toPathState(p)]));
    } catch (err) {
      this.logger.warn(`MediaMTX API unreachable: ${(err as Error).message}`);
      return null;
    }
  }

  /** Recorded segments per path (GET /v3/recordings/list), or null when unreachable. */
  async getRecordings(): Promise<Map<string, RecordingState> | null> {
    try {
      const res = await fetch(
        `${this.apiUrl}/v3/recordings/list?itemsPerPage=1000`,
        { signal: AbortSignal.timeout(2000) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        items: { name: string; segments: { start: string }[] }[];
      };
      return new Map(
        body.items.map((r) => [
          r.name,
          {
            availableFrom:
              r.segments
                .map((seg) => seg.start)
                .sort((a, b) => a.localeCompare(b))[0] ?? null,
            segments: r.segments.length,
          },
        ]),
      );
    } catch (err) {
      this.logger.warn(
        `MediaMTX recordings unreachable: ${(err as Error).message}`,
      );
      return null;
    }
  }
}

function toPathState(p: MediamtxPath): PathState {
  const video = p.tracks2?.find((t) => VIDEO_CODECS.includes(t.codec));
  return {
    online: p.online ?? p.ready,
    onlineSince: p.onlineTime ?? p.readyTime,
    tracks: p.tracks,
    video: video
      ? {
          codec: video.codec,
          width: video.codecProps?.width ?? null,
          height: video.codecProps?.height ?? null,
        }
      : null,
    bytesReceived: p.inboundBytes ?? p.bytesReceived ?? 0,
    readers: p.readers.length,
  };
}
