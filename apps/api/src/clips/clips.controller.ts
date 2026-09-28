import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { ClipStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClipStorage } from './clip-storage.service.js';
import { ClipsService } from './clips.service.js';

@ApiTags('clips')
@Controller('clips')
export class ClipsController {
  constructor(
    private readonly clips: ClipsService,
    private readonly storage: ClipStorage,
    private readonly prisma: PrismaService,
  ) {}

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
