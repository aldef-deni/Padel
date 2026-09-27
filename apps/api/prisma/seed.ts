import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password.js';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Idempoten: aman dijalankan berulang kali.
async function main() {
  const club = await prisma.club.upsert({
    where: { slug: 'padel-contoh' },
    update: {},
    create: {
      name: 'Klub Padel Contoh',
      slug: 'padel-contoh',
      address: 'Jakarta',
      timezone: 'Asia/Jakarta',
    },
  });

  for (const n of [1, 2, 3]) {
    const court = await prisma.court.upsert({
      where: { clubId_name: { clubId: club.id, name: `Lapangan ${n}` } },
      update: {},
      create: { clubId: club.id, name: `Lapangan ${n}` },
    });
    await prisma.camera.upsert({
      where: { streamPath: `court-${n}` },
      update: {},
      create: {
        courtId: court.id,
        name: `Kamera Lapangan ${n}`,
        streamPath: `court-${n}`,
      },
    });
  }

  // Akun admin dari env. Password hanya di-set saat akun pertama kali dibuat.
  await seedAdmin(
    process.env.SEED_ADMIN_EMAIL,
    process.env.SEED_ADMIN_PASSWORD,
    Role.SUPER_ADMIN,
    null,
  );
  await seedAdmin(
    process.env.SEED_CLUB_ADMIN_EMAIL,
    process.env.SEED_CLUB_ADMIN_PASSWORD,
    Role.CLUB_ADMIN,
    club.id,
  );

  const counts = {
    clubs: await prisma.club.count(),
    courts: await prisma.court.count(),
    cameras: await prisma.camera.count(),
    admins: await prisma.user.count({ where: { role: { not: Role.PLAYER } } }),
  };
  console.log('Seed selesai:', counts);
}

async function seedAdmin(
  email: string | undefined,
  password: string | undefined,
  role: Role,
  clubId: string | null,
) {
  if (!email || !password) {
    console.log(`Lewati ${role}: email/password tidak di-set di .env`);
    return;
  }
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      name: role === Role.SUPER_ADMIN ? 'Super Admin' : 'Admin Klub',
      passwordHash: await hashPassword(password),
      role,
      clubId,
    },
  });
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
