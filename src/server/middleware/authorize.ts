import type { Request, Response, NextFunction } from 'express';
import { AppError, ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import * as permissionService from '../modules/permissions/permissions.service.js';

/**
 * Permission-based RBAC middleware factory. Returns middleware that checks
 * whether the session's userRole has the given permission via the
 * PermissionService (database-driven, cached).
 *
 * - super_admin always passes without a DB lookup.
 * - On service error the request is denied with 500 (fail-closed).
 *
 * Usage:
 * ```ts
 * router.get('/users', authenticate, authorize('users'), controller.list);
 * ```
 */
export function authorize(permission: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const userRole = (req.session as any)?.userRole;

    if (!userRole) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // super_admin always passes
    if (userRole === 'super_admin') {
      return next();
    }

    try {
      const allowed = await permissionService.hasPermission(userRole, permission);
      if (!allowed) {
        return next(new ForbiddenError('Insufficient privileges'));
      }
      next();
    } catch (_err) {
      next(new AppError('Permission check failed', 500, 'INTERNAL_ERROR'));
    }
  };
}
