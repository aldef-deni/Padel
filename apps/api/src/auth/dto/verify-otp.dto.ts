import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { RequestOtpDto } from './request-otp.dto.js';

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
