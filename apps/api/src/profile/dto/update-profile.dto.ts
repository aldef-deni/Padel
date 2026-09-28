import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { USERNAME_PATTERN } from '../../users/dto/user.dto.js';

/** Own profile; undefined keeps a field, null clears it. Role and club are not editable here. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Matches(USERNAME_PATTERN, {
    message: 'username must be 3-32 characters: letters, digits, . _ -',
  })
  username?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Tidak untuk PLAYER',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;
}
