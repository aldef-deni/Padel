import {
  Body,
  Controller,
  Delete,
  Get,
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
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { UserEntity } from '../auth/dto/auth.entities.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ProfileService } from './profile.service.js';

/** Upload limit; the web app already crops & resizes to 512×512 before uploading. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

@ApiTags('profile')
@Controller()
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Patch('auth/me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserEntity })
  @ApiBadRequestResponse({
    description: 'Data tidak valid, atau admin tanpa username/email',
  })
  @ApiConflictResponse({
    description: 'Username, email atau telepon sudah dipakai',
  })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.profile.update(user.id, dto);
  }

  @Post('auth/me/avatar')
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PNG, JPEG atau WebP, maks. 2 MB',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ type: UserEntity })
  @ApiBadRequestResponse({ description: 'Bukan PNG/JPEG/WebP' })
  @ApiPayloadTooLargeResponse({ description: 'Lebih dari 2 MB' })
  setAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    return this.profile.setAvatar(user.id, file?.buffer);
  }

  @Delete('auth/me/avatar')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserEntity })
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.profile.removeAvatar(user.id);
  }

  @Public()
  @Get('users/:id/avatar')
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  @ApiOkResponse({ description: 'Foto profil (publik)' })
  @ApiNotFoundResponse()
  async avatar(@Param('id') id: string, @Res() res: Response) {
    const { path, contentType } = await this.profile.avatarFile(id);
    res.sendFile(path, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}
