import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { CamerasController } from './cameras.controller.js';
import { CamerasService } from './cameras.service.js';

@Module({
  imports: [MediaModule],
  controllers: [CamerasController],
  providers: [CamerasService],
})
export class CamerasModule {}
