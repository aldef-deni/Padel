import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCourtDto } from './create-court.dto.js';

export class UpdateCourtDto extends PartialType(
  OmitType(CreateCourtDto, ['clubId'] as const),
) {}
