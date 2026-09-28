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
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ADMIN_ROLES, Roles } from '../auth/decorators/roles.decorator.js';
import {
  CreateTournamentDto,
  DrawDto,
  ListTournamentsQuery,
  MatchResultDto,
  ScheduleMatchDto,
  TeamDto,
  TournamentStatusDto,
  UpdateTeamDto,
  UpdateTournamentDto,
} from './dto/tournament.dto.js';
import { TournamentsService } from './tournaments.service.js';

const DETAIL = {
  description: 'TournamentDetail (tipe lengkap di @padel/shared)',
};

@ApiTags('tournaments')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Bukan admin klub turnamen ini' })
@Roles(...ADMIN_ROLES)
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Get()
  @ApiOkResponse({ description: 'TournamentListResponse' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListTournamentsQuery) {
    return this.tournaments.list(user, query);
  }

  @Post()
  @ApiOkResponse(DETAIL)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTournamentDto) {
    return this.tournaments.create(user, dto);
  }

  @Get(':id')
  @ApiOkResponse(DETAIL)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tournaments.get(user, id);
  }

  @Patch(':id')
  @ApiOkResponse(DETAIL)
  @ApiConflictResponse({
    description: 'Format/aturan skor dikunci setelah undian',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournaments.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiConflictResponse({
    description: 'Sedang berjalan/selesai: batalkan saja',
  })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tournaments.remove(user, id);
  }

  @Post(':id/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Buka/tutup pendaftaran atau batalkan' })
  @ApiOkResponse(DETAIL)
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TournamentStatusDto,
  ) {
    return this.tournaments.setStatus(user, id, dto.status);
  }

  @Post(':id/teams')
  @ApiOkResponse(DETAIL)
  @ApiConflictResponse({
    description: 'Penuh, nama tim dipakai, atau turnamen sudah mulai',
  })
  addTeam(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TeamDto,
  ) {
    return this.tournaments.addTeam(user, id, dto);
  }

  @Patch(':id/teams/:teamId')
  @ApiOkResponse(DETAIL)
  updateTeam(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.tournaments.updateTeam(user, id, teamId, dto);
  }

  @Delete(':id/teams/:teamId')
  @ApiOkResponse(DETAIL)
  removeTeam(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('teamId') teamId: string,
  ) {
    return this.tournaments.removeTeam(user, id, teamId);
  }

  @Post(':id/draw')
  @HttpCode(200)
  @ApiOperation({ summary: 'Undian: buat grup/bagan dan mulai turnamen' })
  @ApiOkResponse(DETAIL)
  @ApiBadRequestResponse({ description: 'Tim kurang untuk format ini' })
  draw(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DrawDto,
  ) {
    return this.tournaments.draw(user, id, dto);
  }

  @Delete(':id/draw')
  @ApiOperation({ summary: 'Batalkan undian (belum ada hasil)' })
  @ApiOkResponse(DETAIL)
  resetDraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tournaments.resetDraw(user, id);
  }

  @Post(':id/knockout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Grup + gugur: buat bagan dari klasemen grup' })
  @ApiOkResponse(DETAIL)
  generateKnockout(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tournaments.generateKnockout(user, id);
  }

  @Delete(':id/knockout')
  @ApiOkResponse(DETAIL)
  resetKnockout(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tournaments.resetKnockout(user, id);
  }

  @Patch(':id/matches/:matchId')
  @ApiOperation({ summary: 'Jadwal: lapangan & waktu' })
  @ApiOkResponse(DETAIL)
  schedule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: ScheduleMatchDto,
  ) {
    return this.tournaments.schedule(user, id, matchId, dto);
  }

  @Post(':id/matches/:matchId/result')
  @HttpCode(200)
  @ApiOperation({ summary: 'Input/ubah skor atau walkover' })
  @ApiOkResponse(DETAIL)
  @ApiBadRequestResponse({ description: 'Skor tidak sesuai aturan' })
  @ApiConflictResponse({
    description: 'Pertandingan berikutnya sudah ada hasil',
  })
  recordResult(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('matchId') matchId: string,
    @Body() dto: MatchResultDto,
  ) {
    return this.tournaments.recordResult(user, id, matchId, dto);
  }

  @Delete(':id/matches/:matchId/result')
  @ApiOkResponse(DETAIL)
  clearResult(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('matchId') matchId: string,
  ) {
    return this.tournaments.clearResult(user, id, matchId);
  }
}

/** Public tournament page data (no login). */
@ApiTags('tournaments')
@Controller('public/tournaments')
export class PublicTournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Public()
  @Get(':slug')
  @ApiOkResponse({ description: 'TournamentDetail tanpa data admin' })
  get(@Param('slug') slug: string) {
    return this.tournaments.getPublic(slug);
  }
}
