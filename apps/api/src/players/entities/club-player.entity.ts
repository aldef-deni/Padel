import { ApiProperty } from '@nestjs/swagger';
import type {
  ClubPlayer,
  ClubPlayerListResponse,
  CreateClubPlayerResponse,
} from '@padel/shared';

export class ClubPlayerEntity implements ClubPlayer {
  @ApiProperty({ description: 'ID akun pemain' }) id: string;
  @ApiProperty({ type: String, nullable: true }) name: string | null;
  @ApiProperty({ type: String, nullable: true, example: '+6281234567890' })
  phone: string | null;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty() accountActive: boolean;
  @ApiProperty() isBlocked: boolean;
  @ApiProperty({ type: String, nullable: true }) note: string | null;
  @ApiProperty() joinedAt: string;
  @ApiProperty({ type: String, nullable: true }) lastLoginAt: string | null;
  @ApiProperty() sessionsCount: number;
  @ApiProperty() clipsCount: number;
  @ApiProperty({ type: String, nullable: true }) lastPlayedAt: string | null;
}

class PlayerCounts {
  @ApiProperty() ALL: number;
  @ApiProperty() ACTIVE: number;
  @ApiProperty() BLOCKED: number;
}

export class ClubPlayerListResponseEntity implements ClubPlayerListResponse {
  @ApiProperty({ type: [ClubPlayerEntity] }) items: ClubPlayerEntity[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty({ type: PlayerCounts }) counts: PlayerCounts;
}

export class CreateClubPlayerResponseEntity implements CreateClubPlayerResponse {
  @ApiProperty({ type: ClubPlayerEntity }) player: ClubPlayerEntity;
  @ApiProperty({
    description: 'Nomor sudah punya akun; hanya ditambahkan ke klub',
  })
  existingAccount: boolean;
}
