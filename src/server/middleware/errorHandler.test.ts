import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from './errorHandler.js';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  UnauthorizedError,
  RateLimitError,
} from '../lib/errors.js';

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const mockReq = {} as Request;
const mockNext = vi.fn() as NextFunction;

describe('errorHandler', () => {
  it('handles AppError with correct status and code', () => {
    const res = createMockRes();
    const err = new AppError('Something went wrong', 400, 'BAD_REQUEST');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'BAD_REQUEST', message: 'Something went wrong' },
    });
  });

  it('handles NotFoundError', () => {
    const res = createMockRes();
    errorHandler(new NotFoundError('User not found'), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
  });

  it('handles ForbiddenError', () => {
    const res = createMockRes();
    errorHandler(new ForbiddenError(), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    });
  });

  it('handles UnauthorizedError', () => {
    const res = createMockRes();
    errorHandler(new UnauthorizedError(), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  });

  it('handles RateLimitError', () => {
    const res = createMockRes();
    errorHandler(new RateLimitError(), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
    });
  });

  it('handles ValidationError with details', () => {
    const res = createMockRes();
    const err = new ValidationError('Validation failed', {
      email: ['Invalid email format'],
      name: ['Name is required'],
    });

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          email: ['Invalid email format'],
          name: ['Name is required'],
        },
      },
    });
  });

  it('handles CSRF token errors', () => {
    const res = createMockRes();
    const err = new Error('invalid csrf token');
    (err as any).code = 'EBADCSRFTOKEN';

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INVALID_CSRF_TOKEN', message: 'Invalid or missing CSRF token' },
    });
  });

  it('handles JSON parse errors', () => {
    const res = createMockRes();
    const err = new Error('Unexpected token');
    (err as any).type = 'entity.parse.failed';
    (err as any).status = 400;

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'BAD_REQUEST', message: 'Invalid request body' },
    });
  });

  it('returns 500 for unexpected errors without leaking details', () => {
    const res = createMockRes();
    const err = new Error('Database connection failed');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });
});
