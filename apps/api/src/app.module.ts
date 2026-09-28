import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { CamerasModule } from './cameras/cameras.module.js';
import { ClubsModule } from './clubs/clubs.module.js';
import { HttpThrottlerGuard } from './common/http-throttler.guard.js';
import { CourtsModule } from './courts/courts.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { TvModule } from './tv/tv.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default limit per IP; auth routes set stricter limits with @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
        // Separate key space per environment (e2e tests use their own).
        prefix: config.get('BULLMQ_PREFIX', 'padel'),
      }),
    }),
    PrismaModule,
    AuthModule,
    ClubsModule,
    CourtsModule,
    CamerasModule,
    SessionsModule,
    TvModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: HttpThrottlerGuard }],
})
export class AppModule {}
