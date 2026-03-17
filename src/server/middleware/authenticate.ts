import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../lib/errors.js';

/**
 * Session validation middleware for protected routes.
 * Checks that the request has a valid session with a userId.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const userId = (req.session as any)?.userId;

  if (!userId) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  next();
}
