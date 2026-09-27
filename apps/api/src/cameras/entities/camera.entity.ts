import { ApiProperty } from '@nestjs/swagger';
import type { Camera } from '../../generated/prisma/client.js';

export class CameraEntity implements Camera {
  @ApiProperty() id: string;
  @ApiProperty() courtId: string;
  @ApiProperty() name: string;
  @ApiProperty({ example: 'court-1' }) streamPath: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
