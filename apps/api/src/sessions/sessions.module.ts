import { Module } from '@nestjs/common';
import { ClipsModule } from '../clips/clips.module.js';
import { SessionAccessModule } from './session-access.module.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [SessionAccessModule, ClipsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
