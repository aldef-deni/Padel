import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';

export class UserEntity {
  @ApiProperty() id: string;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty({ type: String, nullable: true }) username: string | null;
  @ApiProperty({ type: String, nullable: true, example: '+6281234567890' })
  phone: string | null;
  @ApiProperty({ type: String, nullable: true }) name: string | null;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty({ type: String, nullable: true }) clubId: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'URL foto profil' })
  avatarUrl: string | null;
  @ApiProperty({ type: String, nullable: true }) lastLoginAt: string | null;
  @ApiProperty() createdAt: string;
}

export class AuthResponseEntity {
  @ApiProperty() accessToken: string;
  @ApiProperty({ type: UserEntity }) user: UserEntity;
}

export class OtpRequestedEntity {
  @ApiProperty({ example: '+6281234567890' }) phone: string;
  @ApiProperty({ example: 300 }) expiresInSec: number;
  @ApiProperty({ example: 60 }) resendInSec: number;
  @ApiPropertyOptional({
    description: 'Hanya di instance demo (tanpa SMTP): kode masuk',
  })
  demoCode?: string;
}

export class EmailCodeRequestedEntity {
  @ApiProperty({ example: 'pemain@contoh.id' }) email: string;
  @ApiProperty({ example: 600 }) expiresInSec: number;
  @ApiProperty({ example: 60 }) resendInSec: number;
}
