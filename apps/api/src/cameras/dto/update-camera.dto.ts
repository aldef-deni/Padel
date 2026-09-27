import { PartialType } from '@nestjs/swagger';
import { CreateCameraDto } from './create-camera.dto.js';

export class UpdateCameraDto extends PartialType(CreateCameraDto) {}
