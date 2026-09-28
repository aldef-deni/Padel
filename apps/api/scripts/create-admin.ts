/**
 * Membuat atau memperbarui akun admin (belum ada endpoint kelola user).
 *
 *   ADMIN_PASSWORD='...' pnpm user:admin --username aldeftech [--email a@b.c] [--role SUPER_ADMIN|CLUB_ADMIN] [--club <clubId>]
 *
 * Password dibaca dari env ADMIN_PASSWORD (tidak lewat argumen agar tidak tersimpan di riwayat shell
 * sebagai argumen proses). Jika username/email sudah ada, password & role diperbarui dan semua token
 * lama akun itu dicabut.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password.js';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const { values } = parseArgs({
  options: {
    username: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: Role.SUPER_ADMIN },
    club: { type: 'string' },
  },
});

function fail(message: string): never {
  console.error(`Gagal: ${message}`);
  process.exit(1);
}

const username = values.username?.trim().toLowerCase();
const email = values.email?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '';
const role = values.role as Role;

if (!username && !email) fail('isi --username dan/atau --email');
if (username && !USERNAME.test(username))
  fail('username: 3-32 karakter a-z 0-9 . _ -');
if (email && !/^[^@\s]+@[^@\s]+$/.test(email)) fail('email tidak valid');
if (password.length < 12) fail('ADMIN_PASSWORD minimal 12 karakter');
if (role !== Role.SUPER_ADMIN && role !== Role.CLUB_ADMIN)
  fail('role harus SUPER_ADMIN atau CLUB_ADMIN');
if (role === Role.CLUB_ADMIN && !values.club)
  fail('CLUB_ADMIN butuh --club <clubId>');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

try {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [username ? { username } : {}, email ? { email } : {}].filter(
        (w) => Object.keys(w).length,
      ),
    },
  });
  const data = {
    username: username ?? existing?.username ?? null,
    email: email ?? existing?.email ?? null,
    name: values.name ?? existing?.name ?? username ?? email ?? null,
    passwordHash: await hashPassword(password),
    // Changing the password revokes every token issued before (see JwtAuthGuard).
    passwordChangedAt: new Date(),
    role,
    clubId: role === Role.CLUB_ADMIN ? values.club! : null,
  };
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data })
    : await prisma.user.create({ data });
  console.log(
    `${existing ? 'Diperbarui' : 'Dibuat'}: ${user.role} ${user.username ?? ''} ${user.email ?? ''} (id ${user.id})`,
  );
} finally {
  await prisma.$disconnect();
}
