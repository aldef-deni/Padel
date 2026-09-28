import { Module } from '@nestjs/common';
import { ClubsController } from './clubs.controller.js';
import { ClubsService } from './clubs.service.js';
import { LogoStorage } from './logo-storage.service.js';

@Module({
  controllers: [ClubsController],
  providers: [ClubsService, LogoStorage],
})
export class ClubsModule {}
