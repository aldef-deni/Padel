import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SessionAccessModule } from '../sessions/session-access.module.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  imports: [AuthModule, SessionAccessModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
