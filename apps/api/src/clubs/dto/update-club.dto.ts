import { PartialType } from '@nestjs/swagger';
import { CreateClubDto } from './create-club.dto.js';

export class UpdateClubDto extends PartialType(CreateClubDto) {}
