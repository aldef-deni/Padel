import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ListCourtsQuery {
  @ApiPropertyOptional({ description: 'Filter lapangan per klub' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clubId?: string;
}
