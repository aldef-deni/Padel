import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client.js';
import type { AuthUser } from '../auth-user.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Global guard: enforces @Roles(); routes without it only need authentication. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    return !!user && roles.includes(user.role);
  }
}
