import { ApiProperty } from '@nestjs/swagger';
import type { TvLink, TvSnapshot } from '@padel/shared';
import { ClipEntity } from '../../clips/entities/clip.entity.js';

export class TvLinkEntity implements TvLink {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'http://localhost:5173/tv/<clubId>?key=<rahasia>',
  })
  url: string | null;
}

class TvClub {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) logoUrl: string | null;
}

class TvCourt {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

class TvCamera {
  @ApiProperty() id: string;
  @ApiProperty() courtId: string;
  @ApiProperty() name: string;
}

export class TvSnapshotEntity implements TvSnapshot {
  @ApiProperty({ type: TvClub }) club: TvClub;
  @ApiProperty({ type: [TvCourt] }) courts: TvCourt[];
  @ApiProperty({ type: [TvCamera] }) cameras: TvCamera[];
  @ApiProperty({
    type: [ClipEntity],
    description: 'Klip READY terbaru (maks. 10)',
  })
  recentClips: ClipEntity[];
}
