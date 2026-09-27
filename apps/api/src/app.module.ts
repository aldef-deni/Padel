import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CamerasModule } from './cameras/cameras.module.js';
import { ClubsModule } from './clubs/clubs.module.js';
import { CourtsModule } from './courts/courts.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ClubsModule,
    CourtsModule,
    CamerasModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
