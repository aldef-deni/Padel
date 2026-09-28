import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ADMIN_ROLES, Roles } from '../auth/decorators/roles.decorator.js';
import { TvLinkEntity, TvSnapshotEntity } from './entities/tv.entity.js';
import { TvService } from './tv.service.js';

@ApiTags('tv')
@Controller()
export class TvController {
  constructor(private readonly tv: TvService) {}

  @Get('clubs/:id/tv-link')
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOkResponse({ type: TvLinkEntity })
  getLink(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tv.getLink(user, id);
  }

  @Post('clubs/:id/tv-link')
  @Roles(...ADMIN_ROLES)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({
    type: TvLinkEntity,
    description: 'Link baru; link lama langsung tidak berlaku',
  })
  rotateLink(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tv.rotateLink(user, id);
  }

  @Public()
  @Get('tv/:clubId')
  @ApiQuery({ name: 'key', required: true, description: 'Kunci dari link TV' })
  @ApiOkResponse({ type: TvSnapshotEntity })
  @ApiUnauthorizedResponse({ description: 'Kunci salah atau sudah diganti' })
  snapshot(
    @Param('clubId') clubId: string,
    @Query('key') key: string | undefined,
  ) {
    return this.tv.snapshot(clubId, key);
  }
}
