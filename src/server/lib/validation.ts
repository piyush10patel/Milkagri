/**
 * Zod schema validation middleware factory for Express.
 *
 * Creates middleware that validates `req.body`, `req.query`, and/or `req.params`
 * against provided Zod schemas. On failure it throws a `ValidationError` with
 * field-level error details that the centralised error handler picks up.
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from './errors.js';
import { sanitizeDeep } from './sanitize.js';

export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Convert a ZodError into a `Record<string, string[]>` mapping field paths to
 * their human-readable error messages.
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!details[path]) details[path] = [];
    details[path].push(issue.message);
  }
  return details;
}

/**
 * Express middleware factory.
 *
 * ```ts
 * router.post('/customers', validate({ body: createCustomerSchema }), controller.create);
 * ```
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const allDetails: Record<string, string[]> = {};

    if (schemas.body) {
      const sanitizedBody = sanitizeDeep(req.body);
      const result = schemas.body.safeParse(sanitizedBody);
      if (!result.success) {
        Object.assign(allDetails, formatZodErrors(result.error));
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        const queryErrors = formatZodErrors(result.error);
        for (const [key, msgs] of Object.entries(queryErrors)) {
          const prefixed = `query.${key}`;
          allDetails[prefixed] = (allDetails[prefixed] || []).concat(msgs);
        }
      } else {
        req.query = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        const paramErrors = formatZodErrors(result.error);
        for (const [key, msgs] of Object.entries(paramErrors)) {
          const prefixed = `params.${key}`;
          allDetails[prefixed] = (allDetails[prefixed] || []).concat(msgs);
        }
      } else {
        req.params = result.data;
      }
    }

    if (Object.keys(allDetails).length > 0) {
      next(new ValidationError('Validation failed', allDetails));
      return;
    }

    next();
  };
}
