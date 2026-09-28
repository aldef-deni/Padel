import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL_OPTIONS = { require_protocol: true, protocols: ['http', 'https'] };

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

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Jl. Sudirman No. 1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Jakarta Selatan',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ example: 'Asia/Jakarta', default: 'Asia/Jakarta' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '081234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'halo@padelarena.id',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://padelarena.id',
  })
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(255)
  website?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'padelarena.id',
    description: 'Username, "@username" atau URL profil',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  instagram?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://maps.app.goo.gl/xyz',
  })
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(500)
  mapsUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '06:00' })
  @IsOptional()
  @Matches(TIME, { message: 'openTime must be HH:mm' })
  openTime?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '23:00' })
  @IsOptional()
  @Matches(TIME, { message: 'closeTime must be HH:mm' })
  closeTime?: string | null;

  @ApiPropertyOptional({ default: true, description: 'Hanya SUPER_ADMIN' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListClubsQuery {
  @ApiPropertyOptional({ description: 'Cari di nama, slug, kota' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 12, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
