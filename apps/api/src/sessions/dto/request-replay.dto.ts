import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RequestReplayDto {
  @ApiPropertyOptional({
    default: 30,
    minimum: 5,
    maximum: 120,
    description: 'Detik ke belakang dari saat tombol ditekan',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  durationSec?: number;
}
