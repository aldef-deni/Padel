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
import { CourtsService } from './courts.service.js';
import { CreateCourtDto } from './dto/create-court.dto.js';
import { ListCourtsQuery } from './dto/list-courts.query.js';
import { UpdateCourtDto } from './dto/update-court.dto.js';
import { CourtEntity } from './entities/court.entity.js';

@ApiTags('courts')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse({ description: 'Bukan admin atau bukan klub Anda' })
@Roles(...ADMIN_ROLES)
@Controller('courts')
export class CourtsController {
  constructor(private readonly courts: CourtsService) {}

  @Post()
  @ApiCreatedResponse({ type: CourtEntity })
  @ApiBadRequestResponse({ description: 'Validasi gagal atau klub tidak ada' })
  @ApiConflictResponse({
    description: 'Nama lapangan sudah dipakai di klub ini',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCourtDto) {
    return this.courts.create(user, dto);
  }

  @Get()
  @ApiOkResponse({ type: [CourtEntity] })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListCourtsQuery) {
    return this.courts.findAll(user, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CourtEntity })
  @ApiNotFoundResponse()
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.courts.findOne(user, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CourtEntity })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description: 'Nama lapangan sudah dipakai di klub ini',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourtDto,
  ) {
    return this.courts.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Lapangan masih punya kamera atau sesi' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.courts.remove(user, id);
  }
}
