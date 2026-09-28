import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const STATUSES = ['PENDING', 'PROCESSING', 'READY', 'FAILED'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ListClipsQuery {
  @ApiPropertyOptional({ description: 'Wajib untuk admin klub = klubnya' })
  @IsOptional()
  @IsString()
  clubId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() courtId?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ description: 'Tanggal lokal klub YYYY-MM-DD' })
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @ApiPropertyOptional({ description: 'Tanggal lokal klub YYYY-MM-DD (inklusif)' })
  @IsOptional()
  @Matches(DATE)
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
