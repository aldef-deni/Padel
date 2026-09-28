import { ApiProperty } from '@nestjs/swagger';
import type { ClubOverview, RecentClip } from '@padel/shared';
import { ClipEntity } from '../../clips/entities/clip.entity.js';

class ActiveSessionSummary {
  @ApiProperty() sessionId: string;
  @ApiProperty() courtId: string;
  @ApiProperty() startedAt: string;
  @ApiProperty() playerCount: number;
}

class ClipsToday {
  @ApiProperty() total: number;
  @ApiProperty() ready: number;
  @ApiProperty() failed: number;
}

export class RecentClipEntity extends ClipEntity implements RecentClip {
  @ApiProperty() courtId: string;
  @ApiProperty() courtName: string;
  @ApiProperty() cameraName: string;
}

export class ClubOverviewEntity implements ClubOverview {
  @ApiProperty({ type: [ActiveSessionSummary] })
  activeSessions: ActiveSessionSummary[];
  @ApiProperty({
    type: ClipsToday,
    description: 'Klip yang diminta hari ini (zona waktu klub)',
  })
  clipsToday: ClipsToday;
  @ApiProperty({
    type: [RecentClipEntity],
    description: '8 klip terbaru, semua status',
  })
  recentClips: RecentClipEntity[];
}
