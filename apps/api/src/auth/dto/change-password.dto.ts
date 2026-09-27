import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword: string;

  @ApiProperty({
    minLength: 12,
    description: 'Minimal 12 karakter, harus beda dari password lama',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(200)
  newPassword: string;
}
