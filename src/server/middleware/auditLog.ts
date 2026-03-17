import type { Request, Response, NextFunction } from 'express';
import { createAuditLog } from '../modules/audit/audit.service.js';

/**
 * Post-response middleware that records create/update/delete operations
 * to the audit log. Attach audit context to `res.locals.audit` before
 * sending the response, and this middleware will persist it.
 *
 * Usage in a controller:
 * ```ts
 * res.locals.audit = {
 *   actionType: 'create',
 *   entityType: 'customer',
 *   entityId: customer.id,
 *   changes: { name: { old: null, new: 'John' } },
 * };
 * res.status(201).json(customer);
 * ```
 */

export interface AuditContext {
  actionType: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  changes?: Record<string, { old?: unknown; new?: unknown }> | null;
}

export function auditLog() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (body?: unknown) {
      // Fire-and-forget audit log write after response is sent
      const audit = res.locals.audit as AuditContext | undefined;
      const session = (_req.session as any);

      if (audit && session?.userId) {
        createAuditLog({
          userId: session.userId,
          userRole: session.userRole ?? 'unknown',
          actionType: audit.actionType,
          entityType: audit.entityType,
          entityId: audit.entityId,
          changes: audit.changes,
        }).catch((err) => {
          console.error('Failed to write audit log:', err);
        });
      }

      return originalJson(body);
    };

    next();
  };
}
