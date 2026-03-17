import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

/**
 * RBAC middleware factory. Returns middleware that checks the session's
 * userRole against the provided list of allowed roles.
 *
 * Usage:
 * ```ts
 * router.get('/users', authenticate, authorize(['super_admin']), controller.list);
 * ```
 */
export function authorize(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const userRole = (req.session as any)?.userRole;

    if (!userRole) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      next(new ForbiddenError('Insufficient privileges'));
      return;
    }

    next();
  };
}
