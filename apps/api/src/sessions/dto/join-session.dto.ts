import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class JoinSessionDto {
  @ApiProperty({ description: 'Token dari QR lapangan' })
  @IsString()
  @Length(10, 64)
  qrToken: string;
}
