import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ADMIN_ROLES, Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { ClubsService } from './clubs.service.js';
import { CreateClubDto } from './dto/create-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';
import { ClubEntity } from './entities/club.entity.js';

@ApiTags('clubs')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse({ description: 'Bukan admin atau bukan klub Anda' })
@Roles(...ADMIN_ROLES)
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @ApiCreatedResponse({ type: ClubEntity })
  @ApiConflictResponse({ description: 'Slug sudah dipakai' })
  create(@Body() dto: CreateClubDto) {
    return this.clubs.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [ClubEntity] })
  findAll(@CurrentUser() user: AuthUser) {
    return this.clubs.findAll(user);
  }

  @Get(':id')
  @ApiOkResponse({ type: ClubEntity })
  @ApiNotFoundResponse()
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clubs.findOne(user, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ClubEntity })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Slug sudah dipakai' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateClubDto,
  ) {
    return this.clubs.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Klub masih punya lapangan' })
  remove(@Param('id') id: string) {
    return this.clubs.remove(id);
  }
}
