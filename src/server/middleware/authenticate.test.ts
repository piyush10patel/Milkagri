import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from './authenticate.js';

function createMockReq(session: Record<string, unknown> = {}): Request {
  return { session } as unknown as Request;
}

const mockRes = {} as Response;

describe('authenticate middleware', () => {
  it('calls next() when session has userId', () => {
    const next = vi.fn();
    const req = createMockReq({ userId: 'user-1' });

    authenticate(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('returns 401 when session has no userId', () => {
    const next = vi.fn();
    const req = createMockReq({});

    authenticate(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, message: 'Authentication required' }),
    );
  });

  it('returns 401 when session is undefined', () => {
    const next = vi.fn();
    const req = { session: undefined } as unknown as Request;

    authenticate(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 }),
    );
  });
});
