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
  ApiTags,
} from '@nestjs/swagger';
import { ClubsService } from './clubs.service.js';
import { CreateClubDto } from './dto/create-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';
import { ClubEntity } from './entities/club.entity.js';

@ApiTags('clubs')
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Post()
  @ApiCreatedResponse({ type: ClubEntity })
  @ApiConflictResponse({ description: 'Slug sudah dipakai' })
  create(@Body() dto: CreateClubDto) {
    return this.clubs.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [ClubEntity] })
  findAll() {
    return this.clubs.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: ClubEntity })
  @ApiNotFoundResponse()
  findOne(@Param('id') id: string) {
    return this.clubs.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ClubEntity })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Slug sudah dipakai' })
  update(@Param('id') id: string, @Body() dto: UpdateClubDto) {
    return this.clubs.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Klub masih punya lapangan' })
  remove(@Param('id') id: string) {
    return this.clubs.remove(id);
  }
}
