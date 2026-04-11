import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const email = requiredEnv('ADMIN_EMAIL').toLowerCase();
  const password = requiredEnv('ADMIN_PASSWORD');
  const name = process.env.ADMIN_NAME?.trim() || 'Super Admin';

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: 'super_admin',
      isActive: true,
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email,
      name,
      role: 'super_admin',
      isActive: true,
      passwordHash,
    },
  });

  console.log(`Super admin ready: ${user.email}`);
}

main()
  .catch((error) => {
    console.error('Failed to bootstrap admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
