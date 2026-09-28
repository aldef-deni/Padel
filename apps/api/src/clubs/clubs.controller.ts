import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ADMIN_ROLES, Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { ClubsService } from './clubs.service.js';
import { CreateClubDto } from './dto/create-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';
import { ClubEntity } from './entities/club.entity.js';

const MAX_LOGO_BYTES = 1024 * 1024;

/** Subset of the multer file object used here. */
interface UploadedLogo {
  buffer: Buffer;
  size: number;
}

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

  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_LOGO_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PNG, JPEG atau WebP, maks. 1 MB',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ type: ClubEntity })
  @ApiBadRequestResponse({ description: 'Bukan PNG/JPEG/WebP' })
  @ApiPayloadTooLargeResponse({ description: 'Lebih dari 1 MB' })
  uploadLogo(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: UploadedLogo | undefined,
  ) {
    return this.clubs.setLogo(user, id, file?.buffer);
  }

  @Delete(':id/logo')
  @HttpCode(204)
  @ApiNoContentResponse()
  removeLogo(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clubs.removeLogo(user, id);
  }

  @Public()
  @Get(':id/logo')
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  @ApiOkResponse({ description: 'Logo klub (publik, untuk layar TV)' })
  @ApiNotFoundResponse()
  async logo(@Param('id') id: string, @Res() res: Response) {
    const { path, contentType } = await this.clubs.logoFile(id);
    res.sendFile(path, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}
