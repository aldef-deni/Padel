import { Module } from '@nestjs/common';
import { MediamtxService } from './mediamtx.service.js';

@Module({
  providers: [MediamtxService],
  exports: [MediamtxService],
})
export class MediaModule {}
