import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateCameraDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  courtId: string;

  @ApiProperty({ example: 'Kamera Lapangan 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // Harus cocok dengan regex path di infra/mediamtx/mediamtx.yml.
  @ApiProperty({
    example: 'court-1',
    description: 'Path MediaMTX, pola court-<id>',
  })
  @Matches(/^court-[0-9a-z-]+$/, {
    message:
      'streamPath must match court-<id> (lowercase letters, digits, hyphens)',
  })
  @MaxLength(64)
  streamPath: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
