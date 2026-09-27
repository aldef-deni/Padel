import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCourtDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clubId: string;

  @ApiProperty({ example: 'Lapangan 1', description: 'Unik per klub' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
