import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ListCamerasQuery {
  @ApiPropertyOptional({ description: 'Filter kamera per lapangan' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  courtId?: string;
}
