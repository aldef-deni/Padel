import { Module } from '@nestjs/common';
import { ClipsModule } from '../clips/clips.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { TvController } from './tv.controller.js';
import { TvService } from './tv.service.js';

@Module({
  imports: [ClipsModule, RealtimeModule],
  controllers: [TvController],
  providers: [TvService],
})
export class TvModule {}
