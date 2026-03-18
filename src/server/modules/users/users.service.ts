import { prisma } from '../../index.js';
import { redis } from '../../index.js';
import { hashPassword, invalidateUserSessions, normalizeEmail } from '../auth/auth.service.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';
import type { CreateUserInput, UpdateUserInput } from './users.types.js';
import type { PaginationParams } from '../../lib/pagination.js';

export async function listUsers(pagination: PaginationParams) {
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count(),
  ]);
  return { users, total };
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
}

export async function createUser(input: CreateUserInput) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      name: input.name,
      role: input.role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const data: Record<string, unknown> = {};
  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing && existing.id !== id) {
      throw new ConflictError('A user with this email already exists');
    }
    data.email = email;
  }
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.password !== undefined) {
    data.passwordHash = await hashPassword(input.password);
  }

  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deactivateUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: false },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  // Invalidate all active sessions for the deactivated user
  await invalidateUserSessions(id, redis);

  return updated;
}
