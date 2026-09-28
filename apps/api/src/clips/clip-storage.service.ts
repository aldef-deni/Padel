import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { pathToFileURL } from 'node:url';

/** Local clip storage under CLIPS_DIR (to be replaced by R2). */
@Injectable()
export class ClipStorage implements OnModuleInit {
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = config.get('CLIPS_DIR', '/opt/padel/data/clips');
  }

  async onModuleInit() {
    await mkdir(this.dir, { recursive: true });
  }

  filePath(clipId: string) {
    return join(this.dir, `${clipId}.mp4`);
  }

  /** Streams the body to disk; the file only appears once fully written. Returns its URL. */
  async save(
    clipId: string,
    body: ReadableStream<Uint8Array>,
  ): Promise<string> {
    const final = this.filePath(clipId);
    const partial = `${final}.part`;
    try {
      // fetch() bodies are web streams; Node's typings model them separately.
      await pipeline(
        Readable.fromWeb(body as unknown as NodeReadableStream),
        createWriteStream(partial),
      );
      if ((await stat(partial)).size === 0)
        throw new Error('Playback server returned an empty clip');
      await rename(partial, final);
    } catch (err) {
      await rm(partial, { force: true });
      throw err;
    }
    return pathToFileURL(final).href;
  }

  async remove(clipId: string) {
    await rm(this.filePath(clipId), { force: true });
  }
}
