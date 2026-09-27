import { ApiProperty } from '@nestjs/swagger';
import type { Court } from '../../generated/prisma/client.js';

export class CourtEntity implements Court {
  @ApiProperty() id: string;
  @ApiProperty() clubId: string;
  @ApiProperty() name: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
