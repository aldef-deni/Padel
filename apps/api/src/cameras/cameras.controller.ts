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
import { CamerasService } from './cameras.service.js';
import { CreateCameraDto } from './dto/create-camera.dto.js';
import { ListCamerasQuery } from './dto/list-cameras.query.js';
import { UpdateCameraDto } from './dto/update-camera.dto.js';
import { CameraEntity } from './entities/camera.entity.js';

@ApiTags('cameras')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse({ description: 'Bukan admin atau bukan klub Anda' })
@Roles(...ADMIN_ROLES)
@Controller('cameras')
export class CamerasController {
  constructor(private readonly cameras: CamerasService) {}

  @Post()
  @ApiCreatedResponse({ type: CameraEntity })
  @ApiBadRequestResponse({
    description: 'Validasi gagal atau lapangan tidak ada',
  })
  @ApiConflictResponse({ description: 'streamPath sudah dipakai' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCameraDto) {
    return this.cameras.create(user, dto);
  }

  @Get()
  @ApiOkResponse({ type: [CameraEntity] })
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListCamerasQuery) {
    return this.cameras.findAll(user, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CameraEntity })
  @ApiNotFoundResponse()
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cameras.findOne(user, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CameraEntity })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({
    description: 'Validasi gagal atau lapangan tidak ada',
  })
  @ApiConflictResponse({ description: 'streamPath sudah dipakai' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCameraDto,
  ) {
    return this.cameras.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Kamera masih dipakai oleh klip' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cameras.remove(user, id);
  }
}
