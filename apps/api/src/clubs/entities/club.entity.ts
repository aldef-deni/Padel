import { ApiProperty } from '@nestjs/swagger';
import type {
  Club,
  ClubListResponse,
  ClubStats,
  ClubWithStats,
} from '@padel/shared';
import type { Club as ClubRow } from '../../generated/prisma/client.js';

export class ClubEntity implements Club {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ type: String, nullable: true }) address: string | null;
  @ApiProperty({ example: 'Asia/Jakarta' }) timezone: string;
  @ApiProperty({ type: String, nullable: true }) city: string | null;
  @ApiProperty({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ type: String, nullable: true, example: '+6281234567890' })
  phone: string | null;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty({ type: String, nullable: true }) website: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'padelarena.id' })
  instagram: string | null;
  @ApiProperty({ type: String, nullable: true }) mapsUrl: string | null;
  @ApiProperty({ type: String, nullable: true, example: '06:00' }) openTime:
    string | null;
  @ApiProperty({ type: String, nullable: true, example: '23:00' }) closeTime:
    string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '/api/clubs/abc/logo?v=abc-1.png',
  })
  logoUrl: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

class ClubStatsEntity implements ClubStats {
  @ApiProperty() courts: number;
  @ApiProperty() cameras: number;
  @ApiProperty() admins: number;
  @ApiProperty() activeSessions: number;
  @ApiProperty({ description: 'Klip 30 hari terakhir' }) clips30d: number;
}

export class ClubWithStatsEntity extends ClubEntity implements ClubWithStats {
  @ApiProperty({ type: ClubStatsEntity }) stats: ClubStatsEntity;
}

class ClubCounts {
  @ApiProperty() ALL: number;
  @ApiProperty() ACTIVE: number;
  @ApiProperty() INACTIVE: number;
}

export class ClubListResponseEntity implements ClubListResponse {
  @ApiProperty({ type: [ClubWithStatsEntity] }) items: ClubWithStatsEntity[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty({ type: ClubCounts }) counts: ClubCounts;
}

/** Public shape of a club; never exposes the TV key. */
export function toClubEntity(club: ClubRow): ClubEntity {
  return {
    id: club.id,
    name: club.name,
    slug: club.slug,
    address: club.address,
    timezone: club.timezone,
    city: club.city,
    description: club.description,
    phone: club.phone,
    email: club.email,
    website: club.website,
    instagram: club.instagram,
    mapsUrl: club.mapsUrl,
    openTime: club.openTime,
    closeTime: club.closeTime,
    isActive: club.isActive,
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
