import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    example: '081234567890',
    description: 'Format lokal (08..) atau E.164 (+62..)',
  })
  @IsString()
  @MaxLength(32)
  phone: string;
}
