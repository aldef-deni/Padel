import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** ThrottlerGuard for HTTP only; as an APP_GUARD it would otherwise also run on Socket.IO events. */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  override canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return Promise.resolve(true);
    return super.canActivate(context);
  }
}
