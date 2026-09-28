import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ADMIN_ROLES, Roles } from '../auth/decorators/roles.decorator.js';
import { ClipStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClipLibraryService } from './clip-library.service.js';
import { ClipStorage } from './clip-storage.service.js';
import { ClipsService } from './clips.service.js';
import { ListClipsQuery } from './dto/list-clips.query.js';

@ApiTags('clips')
@Controller('clips')
export class ClipsController {
  constructor(
    private readonly clips: ClipsService,
    private readonly storage: ClipStorage,
    private readonly prisma: PrismaService,
    private readonly library: ClipLibraryService,
  ) {}

  /** Replay library: all clips of a club (or every club for SUPER_ADMIN) + storage stats. */
  @Get()
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      '{ items: klip + lapangan/kamera/pemain/sesi, total, page, pageSize, stats }',
  })
  @ApiForbiddenResponse({ description: 'Bukan admin atau bukan klub Anda' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListClipsQuery) {
    return this.library.list(user, query);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Klip & file dihapus' })
  @ApiNotFoundResponse()
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.library.remove(user, id);
  }

  /** Serves a READY clip. Authorized by the signature in `downloadUrl`, not by a token. */
  @Public()
  @Get(':id/file')
  @ApiProduces('video/mp4')
  @ApiQuery({ name: 'exp', required: true })
  @ApiQuery({ name: 'sig', required: true })
  @ApiOkResponse({ description: 'Video MP4 (mendukung Range)' })
  async file(
    @Param('id') id: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.clips.verifySignature(id, exp, sig)) {
      throw new ForbiddenException('Invalid or expired link');
    }
    const clip = await this.prisma.clip.findUnique({ where: { id } });
    if (!clip || clip.status !== ClipStatus.READY)
      throw new NotFoundException();

    res.sendFile(this.storage.filePath(id), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `inline; filename="replay-${id}.mp4"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }
}
