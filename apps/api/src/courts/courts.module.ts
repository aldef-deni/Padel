import { Module } from '@nestjs/common';
import { CourtsController } from './courts.controller.js';
import { CourtsService } from './courts.service.js';

@Module({
  controllers: [CourtsController],
  providers: [CourtsService],
})
export class CourtsModule {}
