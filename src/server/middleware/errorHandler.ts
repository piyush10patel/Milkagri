import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../lib/errors.js';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/**
 * Centralized error handling middleware.
 * Must be registered as the last middleware in the Express pipeline.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Handle AppError (operational errors)
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (err instanceof ValidationError && Object.keys(err.details).length > 0) {
      body.error.details = err.details;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // Handle CSRF token errors (from csurf middleware)
  if (err.message === 'invalid csrf token' || (err as any).code === 'EBADCSRFTOKEN') {
    res.status(403).json({
      error: {
        code: 'INVALID_CSRF_TOKEN',
        message: 'Invalid or missing CSRF token',
      },
    } satisfies ErrorResponse);
    return;
  }

  // Handle JSON parse errors
  if ((err as any).type === 'entity.parse.failed' || (err as any).status === 400) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid request body',
      },
    } satisfies ErrorResponse);
    return;
  }

  // Log unexpected errors in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    console.error('Unhandled error:', err);
  }

  // Generic 500 for unexpected errors — don't leak internals
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  } satisfies ErrorResponse);
}
