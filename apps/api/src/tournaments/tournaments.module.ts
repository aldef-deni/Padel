import { Module } from '@nestjs/common';
import {
  PublicTournamentsController,
  TournamentsController,
} from './tournaments.controller.js';
import { TournamentsService } from './tournaments.service.js';

@Module({
  controllers: [TournamentsController, PublicTournamentsController],
  providers: [TournamentsService],
})
export class TournamentsModule {}
