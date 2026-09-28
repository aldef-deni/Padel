import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@padel/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/** Username of the shared demo account (password "demo", see DEMO_PASSWORD). */
export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'demo';

/**
 * Demo instance (DEMO_MODE=true, demo.padel.aldeftech.com): the shared demo account is
 * protected so every visitor can log in, and the data is reset daily (infra/demo).
 */
@Injectable()
export class DemoService {
  readonly enabled: boolean;
  /** UTC hour of the daily reset (17 = 00:00 WIB). */
  private readonly resetHourUtc: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.enabled = config.get('DEMO_MODE') === 'true';
    this.resetHourUtc = Number(config.get('DEMO_RESET_HOUR_UTC', 17));
  }

  /** Next daily reset after `now`. */
  nextReset(now = new Date()): Date {
    const next = new Date(now);
    next.setUTCHours(this.resetHourUtc, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  appConfig(): AppConfig {
    return {
      demo: this.enabled
        ? {
            username: DEMO_USERNAME,
            password: DEMO_PASSWORD,
            resetAt: this.nextReset().toISOString(),
          }
        : null,
    };
  }

  /** Rejects changes that would lock other visitors out of the shared demo account. */
  async assertNotDemoAccount(userId: string) {
    if (!this.enabled) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    if (user?.username === DEMO_USERNAME)
      throw new ForbiddenException(
        'The demo account cannot be changed (it is shared by all visitors)',
      );
  }
}
