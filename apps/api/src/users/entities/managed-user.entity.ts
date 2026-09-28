import { ApiProperty } from '@nestjs/swagger';
import type { ManagedUser, Role, UserListResponse } from '@padel/shared';
import { Role as RoleEnum } from '../../generated/prisma/client.js';

class ClubRef {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class ManagedUserEntity implements ManagedUser {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true }) name: string | null;
  @ApiProperty({ type: String, nullable: true }) username: string | null;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty({ type: String, nullable: true }) phone: string | null;
  @ApiProperty({ enum: Object.values(RoleEnum) }) role: Role;
  @ApiProperty({ type: String, nullable: true }) clubId: string | null;
  @ApiProperty({ type: ClubRef, nullable: true }) club: ClubRef | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() hasPassword: boolean;
  @ApiProperty({ type: String, nullable: true }) lastLoginAt: string | null;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

class RoleCounts {
  @ApiProperty() ALL: number;
  @ApiProperty() SUPER_ADMIN: number;
  @ApiProperty() CLUB_ADMIN: number;
  @ApiProperty() PLAYER: number;
}

export class UserListResponseEntity implements UserListResponse {
  @ApiProperty({ type: [ManagedUserEntity] }) items: ManagedUserEntity[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty({ type: RoleCounts }) counts: RoleCounts;
}
