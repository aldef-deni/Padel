import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ClipLibraryItem,
  ClipLibraryResponse,
} from '@padel/shared';
import {
  assertClubAccess,
  clubScope,
  type AuthUser,
} from '../auth/auth-user.js';
import { userAvatarUrl } from '../common/avatar-url.js';
import { startOfDayIn } from '../common/time.js';
import { ClipStatus, type Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClipStorage } from './clip-storage.service.js';
import { ClipsService } from './clips.service.js';
import type { ListClipsQuery } from './dto/list-clips.query.js';

const DEFAULT_TZ = 'Asia/Jakarta';

/** Admin replay library: every clip of a club across sessions, with storage stats. */
@Injectable()
export class ClipLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clips: ClipsService,
    private readonly storage: ClipStorage,
  ) {}

  async list(
    user: AuthUser,
    query: ListClipsQuery,
  ): Promise<ClipLibraryResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 24;
    const clubId = clubScope(user) ?? query.clubId;
    if (query.clubId) assertClubAccess(user, query.clubId);
    const club = clubId
      ? await this.prisma.club.findUnique({
          where: { id: clubId },
          select: { timezone: true },
        })
      : null;
    if (clubId && !club) throw new NotFoundException('Club not found');
    const tz = club?.timezone ?? DEFAULT_TZ;

    const scope: Prisma.ClipWhereInput = {
      camera: {
        court: {
          ...(clubId ? { clubId } : {}),
          ...(query.courtId ? { id: query.courtId } : {}),
        },
      },
    };
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = startOfDate(query.from, tz);
    if (query.to) createdAt.lt = startOfDate(nextDate(query.to), tz);
    const where: Prisma.ClipWhereInput = {
      ...scope,
      ...(query.from || query.to ? { createdAt } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total, byStatus, today, storage] = await Promise.all([
      this.prisma.clip.findMany({
        where,
        include: {
          camera: {
            select: {
              id: true,
              name: true,
              court: { select: { id: true, name: true } },
            },
          },
          requestedBy: { select: { id: true, name: true, avatarFile: true } },
          session: { select: { id: true, startedAt: true, endedAt: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.clip.count({ where }),
      this.prisma.clip.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.clip.count({
        where: { ...scope, createdAt: { gte: startOfDayIn(tz) } },
      }),
      this.prisma.clip.aggregate({
        where: { ...scope, status: ClipStatus.READY },
        _sum: { sizeBytes: true },
      }),
    ]);

    const count = (...statuses: ClipStatus[]) =>
      byStatus
        .filter((g) => statuses.includes(g.status))
        .reduce((sum, g) => sum + g._count._all, 0);

    const items: ClipLibraryItem[] = await Promise.all(
      rows.map(async ({ camera, requestedBy, session, ...clip }) => {
        // Clips stored before sizes were recorded: fill in once from disk.
        if (clip.status === ClipStatus.READY && clip.sizeBytes === null) {
          const size = await this.storage.size(clip.id);
          if (size !== null) {
            clip.sizeBytes = size;
            await this.prisma.clip.update({
              where: { id: clip.id },
              data: { sizeBytes: size },
            });
          }
        }
        return Object.assign(this.clips.toEntity(clip), {
          court: camera.court,
          camera: { id: camera.id, name: camera.name },
          requestedBy: {
            id: requestedBy.id,
            name: requestedBy.name,
            avatarUrl: userAvatarUrl(requestedBy),
          },
          session: {
            id: session.id,
            startedAt: session.startedAt.toISOString(),
            endedAt: session.endedAt?.toISOString() ?? null,
          },
        });
      }),
    );

    return {
      items,
      total,
      page,
      pageSize,
      stats: {
        total: count(...Object.values(ClipStatus)),
        ready: count(ClipStatus.READY),
        failed: count(ClipStatus.FAILED),
        inProgress: count(ClipStatus.PENDING, ClipStatus.PROCESSING),
        today,
        storageBytes: storage._sum.sizeBytes ?? 0,
      },
    };
  }

  /** Deletes a clip and its file (frees storage). */
  async remove(user: AuthUser, id: string): Promise<void> {
    const clip = await this.prisma.clip.findUnique({
      where: { id },
      select: { camera: { select: { court: { select: { clubId: true } } } } },
    });
    if (!clip) throw new NotFoundException('Clip not found');
    assertClubAccess(user, clip.camera.court.clubId);
    await this.prisma.clip.delete({ where: { id } });
    await this.storage.remove(id);
  }
}

/** Start of a local calendar day (YYYY-MM-DD) in `timeZone`. */
function startOfDate(date: string, timeZone: string): Date {
  // Noon UTC falls on the same calendar day in every zone between UTC-11 and UTC+11.
  return startOfDayIn(timeZone, new Date(`${date}T12:00:00Z`));
}

function nextDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
