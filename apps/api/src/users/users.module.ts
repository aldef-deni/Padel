import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [ProfileModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
