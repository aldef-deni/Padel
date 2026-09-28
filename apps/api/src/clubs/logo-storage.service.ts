import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

export type LogoType = 'png' | 'jpg' | 'webp';

export const LOGO_CONTENT_TYPES: Record<LogoType, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Detects the image type from its magic bytes (not the client's mimetype).
 * SVG is deliberately not accepted: it can carry scripts.
 */
export function detectLogoType(buf: Buffer): LogoType | null {
  if (
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/** Local logo storage under LOGOS_DIR (to be replaced by R2 like clips). */
@Injectable()
export class LogoStorage implements OnModuleInit {
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = config.get('LOGOS_DIR', '/opt/padel/data/logos');
  }

  async onModuleInit() {
    await mkdir(this.dir, { recursive: true });
  }

  /** Writes a new file and returns its name; names are unique per upload. */
  async save(clubId: string, data: Buffer, type: LogoType): Promise<string> {
    const fileName = `${clubId}-${Date.now()}.${type}`;
    await writeFile(join(this.dir, fileName), data);
    return fileName;
  }

  filePath(fileName: string) {
    return join(this.dir, basename(fileName));
  }

  async remove(fileName: string) {
    await rm(this.filePath(fileName), { force: true });
  }
}
