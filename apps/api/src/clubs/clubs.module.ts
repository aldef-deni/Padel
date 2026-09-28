import { Module } from '@nestjs/common';
import { ClipsModule } from '../clips/clips.module.js';
import { ClubsController } from './clubs.controller.js';
import { ClubsService } from './clubs.service.js';
import { LogoStorage } from './logo-storage.service.js';

@Module({
  imports: [ClipsModule],
  controllers: [ClubsController],
  providers: [ClubsService, LogoStorage],
})
export class ClubsModule {}
