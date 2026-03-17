import bcrypt from 'bcrypt';
import { prisma } from '../../index.js';
import { UnauthorizedError, AppError } from '../../lib/errors.js';
import { dispatchNotification } from '../../lib/notificationProvider.js';

const BCRYPT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

export async function verifyCredentials(email: string, password: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Don't reveal whether email or password is wrong
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Check account lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError('Account is temporarily locked. Please try again later.', 423, 'ACCOUNT_LOCKED');
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    await handleFailedLogin(user.id, user.failedLoginAttempts);
    throw new UnauthorizedError('Invalid credentials');
  }

  // Successful login — reset failed attempts and update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

async function handleFailedLogin(userId: string, currentAttempts: number): Promise<void> {
  const newAttempts = currentAttempts + 1;
  const data: { failedLoginAttempts: number; lockedUntil?: Date } = {
    failedLoginAttempts: newAttempts,
  };

  if (newAttempts >= MAX_FAILED_ATTEMPTS) {
    data.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);

    // Notify admins about account lockout
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    const superAdmins = await prisma.user.findMany({
      where: { role: 'super_admin', isActive: true },
      select: { id: true, email: true },
    });

    if (superAdmins.length > 0) {
      dispatchNotification({
        title: 'Account locked due to failed login attempts',
        body: `Account for ${user?.name ?? userId} (${user?.email ?? 'unknown'}) has been locked after ${MAX_FAILED_ATTEMPTS} failed login attempts.`,
        eventType: 'account_lockout',
        recipientUserIds: superAdmins.map((u) => u.id),
        emailRecipients: superAdmins.map((u) => u.email),
      }).catch(() => {
        // Don't let notification failure break the login flow
      });
    }
  }

  await prisma.user.update({ where: { id: userId }, data });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function invalidateUserSessions(userId: string, redisClient: import('ioredis').default): Promise<void> {
  // Scan for all sessions and remove those belonging to this user.
  // connect-redis stores sessions as sess:<sessionId> with JSON containing userId.
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', 'sess:*', 'COUNT', 100);
    cursor = nextCursor;
    for (const key of keys) {
      const raw = await redisClient.get(key);
      if (raw) {
        try {
          const session = JSON.parse(raw);
          if (session.userId === userId) {
            await redisClient.del(key);
          }
        } catch {
          // skip malformed session data
        }
      }
    }
  } while (cursor !== '0');
}

export { BCRYPT_ROUNDS, MAX_FAILED_ATTEMPTS, LOCKOUT_WINDOW_MS, LOCKOUT_DURATION_MS };
