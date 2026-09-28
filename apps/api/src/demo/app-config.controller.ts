import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AppConfig } from '@padel/shared';
import { Public } from '../auth/decorators/public.decorator.js';
import { DemoService } from './demo.service.js';

@ApiTags('app')
@Controller('public/config')
export class AppConfigController {
  constructor(private readonly demo: DemoService) {}

  /** Public app settings for the web client (e.g. the demo banner and login hint). */
  @Public()
  @Get()
  @ApiOkResponse({
    description:
      '{ demo: null } atau { demo: { username, password, resetAt } } di instance demo',
  })
  get(): AppConfig {
    return this.demo.appConfig();
  }
}
