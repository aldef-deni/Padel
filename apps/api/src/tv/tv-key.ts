import { timingSafeEqual } from 'node:crypto';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Checks a TV link key against the club's current key (constant-time). */
export async function verifyTvKey(
  prisma: PrismaService,
  clubId: string,
  key: unknown,
): Promise<boolean> {
  if (typeof key !== 'string' || !key) return false;
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: { tvKey: true },
  });
  if (!club?.tvKey) return false;
  const expected = Buffer.from(club.tvKey);
  const actual = Buffer.from(key);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
