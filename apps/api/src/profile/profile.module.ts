import { Module } from '@nestjs/common';
import { AvatarStorage } from './avatar-storage.service.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, AvatarStorage],
  exports: [AvatarStorage],
})
export class ProfileModule {}
