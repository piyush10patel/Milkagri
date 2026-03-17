import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  actionType: z.enum(['create', 'update', 'delete']).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  search: z.string().max(255).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
