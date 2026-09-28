import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ADMIN_ROLES, Roles } from '../auth/decorators/roles.decorator.js';
import { ClipEntity } from '../clips/entities/clip.entity.js';
import { Role } from '../generated/prisma/client.js';
import { JoinSessionDto } from './dto/join-session.dto.js';
import { RequestReplayDto } from './dto/request-replay.dto.js';
import {
  ActiveSessionResponseEntity,
  JoinSessionResponseEntity,
  SessionEntity,
  SessionQrEntity,
} from './entities/session.entity.js';
import { SessionsService } from './sessions.service.js';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post('courts/:courtId/sessions')
  @Roles(...ADMIN_ROLES)
  @ApiCreatedResponse({ type: SessionEntity })
  @ApiConflictResponse({ description: 'Lapangan sudah punya sesi aktif' })
  start(@CurrentUser() user: AuthUser, @Param('courtId') courtId: string) {
    return this.sessions.start(user, courtId);
  }

  @Get('courts/:courtId/sessions/active')
  @Roles(...ADMIN_ROLES)
  @ApiOkResponse({ type: ActiveSessionResponseEntity })
  active(@CurrentUser() user: AuthUser, @Param('courtId') courtId: string) {
    return this.sessions.active(user, courtId);
  }

  @Post('sessions/join')
  @Roles(Role.PLAYER)
  @HttpCode(200)
  @ApiOkResponse({ type: JoinSessionResponseEntity })
  @ApiNotFoundResponse({ description: 'QR tidak dikenal' })
  @ApiGoneResponse({ description: 'Sesi sudah berakhir' })
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinSessionDto) {
    return this.sessions.join(user, dto.qrToken);
  }

  @Get('sessions/:id')
  @ApiOkResponse({ type: SessionEntity })
  @ApiForbiddenResponse({
    description: 'Bukan admin klub ini atau belum bergabung',
  })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.get(user, id);
  }

  @Post('sessions/:id/end')
  @Roles(...ADMIN_ROLES)
  @HttpCode(200)
  @ApiOkResponse({ type: SessionEntity })
  end(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.end(user, id);
  }

  @Get('sessions/:id/qr')
  @Roles(...ADMIN_ROLES)
  @ApiOkResponse({ type: SessionQrEntity })
  qr(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.qr(user, id);
  }

  /** The replay button (players who joined, or the club's admins to simulate). */
  @Post('sessions/:id/replays')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(202)
  @ApiAcceptedResponse({
    type: [ClipEntity],
    description: 'Satu klip PENDING per kamera aktif',
  })
  @ApiConflictResponse({
    description: 'Sesi sudah berakhir atau tidak ada kamera aktif',
  })
  requestReplay(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RequestReplayDto,
  ) {
    return this.sessions.requestReplay(user, id, dto.durationSec);
  }

  /** Player app history: sessions I joined, newest first. */
  @Get('me/sessions')
  @Roles(Role.PLAYER)
  @ApiOkResponse({
    description:
      '[{ session, court, club (logoUrl), clips: { total, ready }, lastClipAt }]',
  })
  mySessions(@CurrentUser() user: AuthUser) {
    return this.sessions.mySessions(user);
  }

  @Get('sessions/:id/clips')
  @ApiOkResponse({ type: [ClipEntity] })
  clips(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.listClips(user, id);
  }
}
