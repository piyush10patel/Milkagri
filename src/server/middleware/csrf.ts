import csurf from 'csurf';
import type { Request, Response, NextFunction } from 'express';

/**
 * CSRF protection middleware using csurf with cookie-based double-submit pattern.
 * Applied to state-changing routes (POST, PUT, PATCH, DELETE).
 * The token is sent to the client via a dedicated endpoint or response header.
 */
export const csrfProtection = csurf({
  cookie: false, // use session-based CSRF tokens (stored in req.session)
});

/**
 * Middleware that attaches the CSRF token to the response header.
 * Clients should read `X-CSRF-Token` and include it in subsequent
 * state-changing requests via the `csrf-token` header or `_csrf` body field.
 */
export function csrfTokenProvider(req: Request, res: Response, next: NextFunction): void {
  // csrfProtection must run first to populate req.csrfToken()
  res.setHeader('X-CSRF-Token', req.csrfToken());
  next();
}
