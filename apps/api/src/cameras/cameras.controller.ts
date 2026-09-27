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
  ApiTags,
} from '@nestjs/swagger';
import { CamerasService } from './cameras.service.js';
import { CreateCameraDto } from './dto/create-camera.dto.js';
import { ListCamerasQuery } from './dto/list-cameras.query.js';
import { UpdateCameraDto } from './dto/update-camera.dto.js';
import { CameraEntity } from './entities/camera.entity.js';

@ApiTags('cameras')
@Controller('cameras')
export class CamerasController {
  constructor(private readonly cameras: CamerasService) {}

  @Post()
  @ApiCreatedResponse({ type: CameraEntity })
  @ApiBadRequestResponse({
    description: 'Validasi gagal atau lapangan tidak ada',
  })
  @ApiConflictResponse({ description: 'streamPath sudah dipakai' })
  create(@Body() dto: CreateCameraDto) {
    return this.cameras.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [CameraEntity] })
  findAll(@Query() query: ListCamerasQuery) {
    return this.cameras.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CameraEntity })
  @ApiNotFoundResponse()
  findOne(@Param('id') id: string) {
    return this.cameras.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CameraEntity })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse({
    description: 'Validasi gagal atau lapangan tidak ada',
  })
  @ApiConflictResponse({ description: 'streamPath sudah dipakai' })
  update(@Param('id') id: string, @Body() dto: UpdateCameraDto) {
    return this.cameras.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Kamera masih dipakai oleh klip' })
  remove(@Param('id') id: string) {
    return this.cameras.remove(id);
  }
}
