import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { ClipStorage } from './clip-storage.service.js';
import { CLIPS_QUEUE } from './clips.constants.js';
import { ClipsController } from './clips.controller.js';
import { ClipsProcessor } from './clips.processor.js';
import { ClipsService } from './clips.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: CLIPS_QUEUE }), RealtimeModule],
  controllers: [ClipsController],
  providers: [ClipsService, ClipStorage, ClipsProcessor],
  exports: [ClipsService],
})
export class ClipsModule {}
