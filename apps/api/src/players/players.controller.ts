import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ADMIN_ROLES, Roles } from '../auth/decorators/roles.decorator.js';
import {
  CreatePlayerDto,
  ListPlayersQuery,
  UpdatePlayerDto,
} from './dto/player.dto.js';
import {
  ClubPlayerEntity,
  ClubPlayerListResponseEntity,
  CreateClubPlayerResponseEntity,
} from './entities/club-player.entity.js';
import { PlayersService } from './players.service.js';

@ApiTags('players')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Bukan admin klub ini' })
@Roles(...ADMIN_ROLES)
@Controller('clubs/:clubId/players')
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Get()
  @ApiOkResponse({ type: ClubPlayerListResponseEntity })
  list(
    @CurrentUser() actor: AuthUser,
    @Param('clubId') clubId: string,
    @Query() query: ListPlayersQuery,
  ) {
    return this.players.list(actor, clubId, query);
  }

  @Post()
  @ApiCreatedResponse({ type: CreateClubPlayerResponseEntity })
  @ApiBadRequestResponse({ description: 'Nomor HP tidak valid' })
  @ApiConflictResponse({
    description:
      'Sudah anggota klub, nomor milik akun admin, atau email dipakai',
  })
  create(
    @CurrentUser() actor: AuthUser,
    @Param('clubId') clubId: string,
    @Body() dto: CreatePlayerDto,
  ) {
    return this.players.create(actor, clubId, dto);
  }

  @Patch(':userId')
  @ApiOkResponse({ type: ClubPlayerEntity })
  @ApiNotFoundResponse({ description: 'Bukan anggota klub ini' })
  @ApiConflictResponse({ description: 'Nomor HP atau email sudah dipakai' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('clubId') clubId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdatePlayerDto,
  ) {
    return this.players.update(actor, clubId, userId, dto);
  }

  @Delete(':userId')
  @HttpCode(204)
  @ApiNoContentResponse({
    description: 'Dikeluarkan dari klub; akun & riwayat tetap ada',
  })
  @ApiNotFoundResponse()
  remove(
    @CurrentUser() actor: AuthUser,
    @Param('clubId') clubId: string,
    @Param('userId') userId: string,
  ) {
    return this.players.remove(actor, clubId, userId);
  }
}
