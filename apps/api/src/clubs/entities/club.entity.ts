import { ApiProperty } from '@nestjs/swagger';
import type { Club } from '../../generated/prisma/client.js';

export class ClubEntity implements Club {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ type: String, nullable: true }) address: string | null;
  @ApiProperty({ example: 'Asia/Jakarta' }) timezone: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
