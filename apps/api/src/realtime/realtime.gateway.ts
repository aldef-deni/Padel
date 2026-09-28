import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Clip, SubscribeSessionAck } from '@padel/shared';
import type { Server, Socket } from 'socket.io';
import type { AuthUser } from '../auth/auth-user.js';
import { TokenService } from '../auth/token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessionAccessService } from '../sessions/session-access.service.js';
import { verifyTvKey } from '../tv/tv-key.js';
import {
  clubRoom,
  SOCKET_CLIP_UPDATED,
  SOCKET_SUBSCRIBE_SESSION,
  sessionRoom,
} from './events.js';

/** Either a signed-in user (JWT) or a club TV screen (TV link key). */
type AuthedSocket = Socket & { data: { user?: AuthUser; tvClubId?: string } };

/**
 * Socket.IO at /socket.io.
 * - Apps connect with `auth: { token }` (same JWT as HTTP), then subscribe to sessions.
 * - TV screens connect with `auth: { clubId, tvKey }` and get every clip of that club.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() private server: Server;

  constructor(
    private readonly tokens: TokenService,
    private readonly access: SessionAccessService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    // Authenticate during the handshake so no event can arrive before the user is known.
    server.use((socket, next) => {
      this.authenticate(socket as AuthedSocket)
        .then((ok) => next(ok ? undefined : new Error('Unauthorized')))
        .catch(() => next(new Error('Unauthorized')));
    });
  }

  async handleConnection(client: AuthedSocket) {
    if (client.data.tvClubId) await client.join(clubRoom(client.data.tvClubId));
  }

  private async authenticate(socket: AuthedSocket): Promise<boolean> {
    const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
    if (typeof auth.token === 'string') {
      const user = await this.tokens.verify(auth.token);
      if (user) socket.data.user = user;
      return !!user;
    }
    if (
      typeof auth.clubId === 'string' &&
      (await verifyTvKey(this.prisma, auth.clubId, auth.tvKey))
    ) {
      socket.data.tvClubId = auth.clubId;
      return true;
    }
    return false;
  }

  @SubscribeMessage(SOCKET_SUBSCRIBE_SESSION)
  async subscribeSession(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ): Promise<SubscribeSessionAck> {
    const user = client.data.user;
    if (!user) return { ok: false, error: 'Unauthorized' };
    const sessionId = (body as { sessionId?: unknown } | null)?.sessionId;
    if (typeof sessionId !== 'string')
      return { ok: false, error: 'sessionId is required' };
    try {
      await this.access.get(user, sessionId);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
    await client.join(sessionRoom(sessionId));
    return { ok: true };
  }

  /** Cuts off a club's TV screens, e.g. after the TV link key was replaced. */
  async disconnectTvScreens(clubId: string) {
    const sockets = await this.server.in(clubRoom(clubId)).fetchSockets();
    for (const socket of sockets) {
      if ((socket.data as AuthedSocket['data']).tvClubId === clubId)
        socket.disconnect(true);
    }
  }

  /** Sends a clip update to its session's subscribers and the club's TV screens. */
  emitClip(clip: Clip, clubId: string) {
    this.server
      .to(sessionRoom(clip.sessionId))
      .to(clubRoom(clubId))
      .emit(SOCKET_CLIP_UPDATED, clip);
    this.logger.debug(`clip ${clip.id} -> ${clip.status}`);
  }
}
