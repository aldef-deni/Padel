import { ApiProperty } from '@nestjs/swagger';
import type { CameraStatus, CameraStatusResponse } from '@padel/shared';

class VideoInfoEntity {
  @ApiProperty({ example: 'H264' }) codec: string;
  @ApiProperty({ type: Number, nullable: true, example: 1920 }) width:
    number | null;
  @ApiProperty({ type: Number, nullable: true, example: 1080 }) height:
    number | null;
}

export class CameraStatusEntity implements CameraStatus {
  @ApiProperty() cameraId: string;
  @ApiProperty({ example: 'court-1' }) streamPath: string;
  @ApiProperty() online: boolean;
  @ApiProperty({ type: String, nullable: true }) onlineSince: string | null;
  @ApiProperty({ type: [String], example: ['H264', 'MPEG-4 Audio'] })
  tracks: string[];
  @ApiProperty({ type: VideoInfoEntity, nullable: true })
  video: VideoInfoEntity | null;
  @ApiProperty() bytesReceived: number;
  @ApiProperty({ description: 'Jumlah penonton yang sedang terhubung' })
  readers: number;
}

export class CameraStatusResponseEntity implements CameraStatusResponse {
  @ApiProperty({ description: 'false jika API MediaMTX tidak terjangkau' })
  mediaServerReachable: boolean;
  @ApiProperty({ type: [CameraStatusEntity] }) cameras: CameraStatusEntity[];
}
