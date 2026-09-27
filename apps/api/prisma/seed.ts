import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

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

  const counts = {
    clubs: await prisma.club.count(),
    courts: await prisma.court.count(),
    cameras: await prisma.camera.count(),
  };
  console.log('Seed selesai:', counts);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
