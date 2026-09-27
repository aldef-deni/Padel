import { ForbiddenException } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';

/** The authenticated user attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  role: Role;
  clubId: string | null;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  /** User.passwordChangedAt (ms) when the token was issued; must still match. */
  pwd?: number;
}

/**
 * Club a user is restricted to: undefined for SUPER_ADMIN (all clubs),
 * the user's club for CLUB_ADMIN. A CLUB_ADMIN without a club gets nothing.
 */
export function clubScope(user: AuthUser): string | undefined {
  if (user.role === Role.SUPER_ADMIN) return undefined;
  if (user.role === Role.CLUB_ADMIN && user.clubId) return user.clubId;
  throw new ForbiddenException('No club access');
}

export function assertClubAccess(user: AuthUser, clubId: string) {
  const scope = clubScope(user);
  if (scope !== undefined && scope !== clubId) {
    throw new ForbiddenException('No access to this club');
  }
}
