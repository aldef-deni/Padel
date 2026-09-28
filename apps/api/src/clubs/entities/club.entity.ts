import { ApiProperty } from '@nestjs/swagger';
import type { Club } from '@padel/shared';
import type { Club as ClubRow } from '../../generated/prisma/client.js';

export class ClubEntity implements Club {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ type: String, nullable: true }) address: string | null;
  @ApiProperty({ example: 'Asia/Jakarta' }) timezone: string;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '/api/clubs/abc/logo?v=abc-1.png',
  })
  logoUrl: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

/** Public shape of a club; never exposes the TV key. */
export function toClubEntity(club: ClubRow): ClubEntity {
  return {
    id: club.id,
    name: club.name,
    slug: club.slug,
    address: club.address,
    timezone: club.timezone,
    logoUrl: clubLogoUrl(club),
    createdAt: club.createdAt.toISOString(),
    updatedAt: club.updatedAt.toISOString(),
  };
}

/** The file name changes on every upload, so it doubles as a cache buster. */
export function clubLogoUrl(club: {
  id: string;
  logoFile: string | null;
}): string | null {
  return club.logoFile
    ? `/api/clubs/${club.id}/logo?v=${encodeURIComponent(club.logoFile)}`
    : null;
}
