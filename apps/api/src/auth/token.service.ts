import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser, JwtPayload } from './auth-user.js';

/** Verifies an access token for HTTP (JwtAuthGuard) and Socket.IO connections. */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Returns the user for a valid token, or null. The user is re-read from the DB
   * so role/club changes and deletions apply immediately.
   */
  async verify(token: string): Promise<AuthUser | null> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        clubId: true,
        passwordChangedAt: true,
        isActive: true,
        club: { select: { isActive: true } },
      },
    });
    if (!user?.isActive) return null;
    // A deactivated club locks out its club admins too.
    if (user.role === Role.CLUB_ADMIN && user.club && !user.club.isActive)
      return null;
    // Tokens issued before the last password change are revoked.
    if (payload.pwd !== user.passwordChangedAt?.getTime()) return null;

    return { id: user.id, role: user.role, clubId: user.clubId };
  }
}
