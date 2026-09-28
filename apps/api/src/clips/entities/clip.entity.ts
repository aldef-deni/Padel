import { ApiProperty } from '@nestjs/swagger';
import type { Clip, ClipStatus } from '@padel/shared';

export class ClipEntity implements Clip {
  @ApiProperty() id: string;
  @ApiProperty() sessionId: string;
  @ApiProperty() cameraId: string;
  @ApiProperty() requestedById: string;
  @ApiProperty({ description: 'Awal potongan rekaman' }) startAt: string;
  @ApiProperty() durationSec: number;
  @ApiProperty({ enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED'] })
  status: ClipStatus;
  @ApiProperty({ type: String, nullable: true }) error: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'URL video bertanda tangan (berlaku 1 jam), hanya jika READY',
  })
  downloadUrl: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}
