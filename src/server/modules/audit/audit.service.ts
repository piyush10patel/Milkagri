import { prisma } from '../../index.js';
import type { Prisma } from '@prisma/client';
import type { PaginationParams } from '../../lib/pagination.js';
import type { AuditLogQuery } from './audit.types.js';

export interface CreateAuditLogInput {
  userId: string;
  userRole: string;
  actionType: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  changes?: Record<string, { old?: unknown; new?: unknown }> | null;
}

/**
 * Append-only audit log creation. This is the only write operation —
 * there is no update or delete exposed through the application.
 */
export async function createAuditLog(input: CreateAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      userRole: input.userRole,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
      changes: (input.changes as any) ?? undefined,
    },
  });
}

/**
 * Query audit logs with filtering, search, and pagination.
 */
export async function listAuditLogs(
  query: AuditLogQuery,
  pagination: PaginationParams,
) {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.userId) where.userId = query.userId;
  if (query.actionType) where.actionType = query.actionType;

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }

  if (query.search) {
    where.entityType = { contains: query.search, mode: 'insensitive' };
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total };
}
