import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertClubAccess, type AuthUser } from '../auth/auth-user.js';
import { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Who may see a session: admins of the court's club, and players who joined it.
 * Shared by HTTP endpoints and the Socket.IO gateway.
 */
@Injectable()
export class SessionAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthUser, sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        court: {
          select: { clubId: true, club: { select: { isActive: true } } },
        },
        _count: { select: { players: true } },
      },
    });
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);

    if (user.role === Role.PLAYER) {
      const member = await this.prisma.sessionPlayer.findUnique({
        where: { sessionId_userId: { sessionId, userId: user.id } },
      });
      if (!member) throw new ForbiddenException('Join the session first');
    } else {
      assertClubAccess(user, session.court.clubId);
    }
    return session;
  }
}
