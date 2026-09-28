import { ApiProperty } from '@nestjs/swagger';
import type {
  ActiveSessionResponse,
  JoinSessionResponse,
  Session,
  SessionQr,
} from '@padel/shared';

export class SessionEntity implements Session {
  @ApiProperty() id: string;
  @ApiProperty() courtId: string;
  @ApiProperty({ description: 'Token di QR; pemain scan untuk bergabung' })
  qrToken: string;
  @ApiProperty() startedAt: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'null = masih aktif',
  })
  endedAt: string | null;
  @ApiProperty() playerCount: number;
}

export class ActiveSessionResponseEntity implements ActiveSessionResponse {
  @ApiProperty({ type: SessionEntity, nullable: true })
  session: SessionEntity | null;
}

export class SessionQrEntity implements SessionQr {
  @ApiProperty() qrToken: string;
  @ApiProperty({ example: 'http://localhost:5173/join/abc' }) joinUrl: string;
  @ApiProperty({ description: 'Gambar QR (SVG)' }) svg: string;
}

class NamedRef {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class JoinSessionResponseEntity implements JoinSessionResponse {
  @ApiProperty({ type: SessionEntity }) session: SessionEntity;
  @ApiProperty({ type: NamedRef }) court: NamedRef;
  @ApiProperty({ type: NamedRef }) club: NamedRef;
}

export function toSessionEntity(session: {
  id: string;
  courtId: string;
  qrToken: string;
  startedAt: Date;
  endedAt: Date | null;
  _count: { players: number };
}): SessionEntity {
  return {
    id: session.id,
    courtId: session.courtId,
    qrToken: session.qrToken,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    playerCount: session._count.players,
  };
}
