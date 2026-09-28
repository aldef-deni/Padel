import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { LogoType } from '../clubs/logo-storage.service.js';

/** Local profile photo storage under AVATARS_DIR (to be replaced by R2 like clips). */
@Injectable()
export class AvatarStorage implements OnModuleInit {
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = config.get('AVATARS_DIR', '/opt/padel/data/avatars');
  }

  async onModuleInit() {
    await mkdir(this.dir, { recursive: true });
  }

  async save(userId: string, data: Buffer, type: LogoType): Promise<string> {
    const fileName = `${userId}-${Date.now()}.${type}`;
    await writeFile(join(this.dir, fileName), data);
    return fileName;
  }

  filePath(fileName: string) {
    return join(this.dir, basename(fileName));
  }

  async remove(fileName: string | null | undefined) {
    if (fileName) await rm(this.filePath(fileName), { force: true });
  }
}
