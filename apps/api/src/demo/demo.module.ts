import { Global, Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller.js';
import { DemoService } from './demo.service.js';

@Global()
@Module({
  controllers: [AppConfigController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
