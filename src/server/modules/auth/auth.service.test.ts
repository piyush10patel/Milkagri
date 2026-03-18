import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';

// Mock Prisma
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    user: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
      findUnique: vi.fn(),
      findMany: (...args: any[]) => mockFindMany(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
  },
  redis: {
    scan: vi.fn().mockResolvedValue(['0', []]),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

import { verifyCredentials, hashPassword, invalidateUserSessions } from './auth.service.js';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'admin@test.com',
    passwordHash: '', // set per test
    name: 'Admin',
    role: 'admin',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    ...overrides,
  };
}

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  describe('verifyCredentials', () => {
    it('returns user on valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockFindFirst.mockResolvedValue(makeUser({ passwordHash: hash }));
      mockUpdate.mockResolvedValue({});

      const result = await verifyCredentials('admin@test.com', 'password123');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('admin@test.com');
      expect(result.role).toBe('admin');
    });

    it('throws on invalid email (user not found)', async () => {
      mockFindFirst.mockResolvedValue(null);

      await expect(verifyCredentials('nobody@test.com', 'pass'))
        .rejects.toThrow('Invalid credentials');
    });

    it('throws on wrong password and increments failed attempts', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockFindFirst.mockResolvedValue(makeUser({ passwordHash: hash }));
      mockUpdate.mockResolvedValue({});

      await expect(verifyCredentials('admin@test.com', 'wrong'))
        .rejects.toThrow('Invalid credentials');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ failedLoginAttempts: 1 }),
        }),
      );
    });

    it('locks account after 5 failed attempts', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockFindFirst.mockResolvedValue(
        makeUser({ passwordHash: hash, failedLoginAttempts: 4 }),
      );
      mockUpdate.mockResolvedValue({});

      await expect(verifyCredentials('admin@test.com', 'wrong'))
        .rejects.toThrow('Invalid credentials');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('rejects login when account is locked', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const futureDate = new Date(Date.now() + 30 * 60 * 1000);
      mockFindFirst.mockResolvedValue(
        makeUser({ passwordHash: hash, lockedUntil: futureDate }),
      );

      await expect(verifyCredentials('admin@test.com', 'password123'))
        .rejects.toThrow('Account is temporarily locked');
    });

    it('rejects login for inactive user', async () => {
      mockFindFirst.mockResolvedValue(makeUser({ isActive: false }));

      await expect(verifyCredentials('admin@test.com', 'password123'))
        .rejects.toThrow('Invalid credentials');
    });

    it('resets failed attempts on successful login', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockFindFirst.mockResolvedValue(
        makeUser({ passwordHash: hash, failedLoginAttempts: 3 }),
      );
      mockUpdate.mockResolvedValue({});

      await verifyCredentials('admin@test.com', 'password123');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
    });
  });

  it('matches email case-insensitively', async () => {
    const hash = await bcrypt.hash('password123', 10);
    mockFindFirst.mockResolvedValue(makeUser({ email: 'manager@milkdelivery.local', passwordHash: hash }));
    mockUpdate.mockResolvedValue({});

    const result = await verifyCredentials('Manager@MilkDelivery.Local', 'password123');

    expect(result.email).toBe('manager@milkdelivery.local');
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: { equals: 'manager@milkdelivery.local', mode: 'insensitive' },
        },
      }),
    );
  });

  describe('hashPassword', () => {
    it('produces a valid bcrypt hash', async () => {
      const hash = await hashPassword('mypassword');
      expect(hash).toMatch(/^\$2[aby]\$/);
      const valid = await bcrypt.compare('mypassword', hash);
      expect(valid).toBe(true);
    });
  });

  describe('invalidateUserSessions', () => {
    it('deletes sessions matching the userId', async () => {
      const { redis } = await import('../../index.js');
      const mockRedis = redis as any;
      mockRedis.scan.mockResolvedValueOnce(['0', ['sess:abc', 'sess:def']]);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-1' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-2' }));
      mockRedis.del.mockResolvedValue(1);

      await invalidateUserSessions('user-1', mockRedis);

      expect(mockRedis.del).toHaveBeenCalledWith('sess:abc');
      expect(mockRedis.del).not.toHaveBeenCalledWith('sess:def');
    });
  });
});
