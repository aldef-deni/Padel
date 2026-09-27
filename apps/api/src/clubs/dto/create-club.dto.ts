import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateClubDto {
  @ApiProperty({ example: 'Padel Arena Jakarta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'padel-arena-jakarta',
    description: 'Huruf kecil, angka, dan tanda hubung',
  })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, digits and single hyphens',
  })
  @MaxLength(60)
  slug: string;

  @ApiPropertyOptional({ example: 'Jl. Sudirman No. 1, Jakarta' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'Asia/Jakarta', default: 'Asia/Jakarta' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
