import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

function getOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function shouldAutoBootstrapAdmin(): boolean {
  return process.env.AUTO_BOOTSTRAP_ADMIN === 'true';
}

export function hasBootstrapAdminEnv(): boolean {
  return Boolean(getOptionalEnv('ADMIN_EMAIL') && getOptionalEnv('ADMIN_PASSWORD'));
}

export async function bootstrapSuperAdmin(prisma: PrismaClient): Promise<string> {
  const email = getOptionalEnv('ADMIN_EMAIL')?.toLowerCase();
  const password = getOptionalEnv('ADMIN_PASSWORD');
  const name = getOptionalEnv('ADMIN_NAME') || 'Super Admin';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required for admin bootstrap');
  }

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

  return user.email;
}
