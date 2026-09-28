import { Module } from '@nestjs/common';
import { SessionAccessService } from './session-access.service.js';

@Module({
  providers: [SessionAccessService],
  exports: [SessionAccessService],
})
export class SessionAccessModule {}
