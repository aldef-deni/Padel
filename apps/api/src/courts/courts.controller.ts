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
import { CourtsService } from './courts.service.js';
import { CreateCourtDto } from './dto/create-court.dto.js';
import { ListCourtsQuery } from './dto/list-courts.query.js';
import { UpdateCourtDto } from './dto/update-court.dto.js';
import { CourtEntity } from './entities/court.entity.js';

@ApiTags('courts')
@Controller('courts')
export class CourtsController {
  constructor(private readonly courts: CourtsService) {}

  @Post()
  @ApiCreatedResponse({ type: CourtEntity })
  @ApiBadRequestResponse({ description: 'Validasi gagal atau klub tidak ada' })
  @ApiConflictResponse({
    description: 'Nama lapangan sudah dipakai di klub ini',
  })
  create(@Body() dto: CreateCourtDto) {
    return this.courts.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [CourtEntity] })
  findAll(@Query() query: ListCourtsQuery) {
    return this.courts.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CourtEntity })
  @ApiNotFoundResponse()
  findOne(@Param('id') id: string) {
    return this.courts.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CourtEntity })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description: 'Nama lapangan sudah dipakai di klub ini',
  })
  update(@Param('id') id: string, @Body() dto: UpdateCourtDto) {
    return this.courts.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Lapangan masih punya kamera atau sesi' })
  remove(@Param('id') id: string) {
    return this.courts.remove(id);
  }
}
