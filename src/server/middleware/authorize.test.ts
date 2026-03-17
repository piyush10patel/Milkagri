import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authorize } from './authorize.js';

function createMockReq(session: Record<string, unknown> = {}): Request {
  return { session } as unknown as Request;
}

const mockRes = {} as Response;

describe('authorize middleware', () => {
  it('calls next() when user role is in allowed list', () => {
    const next = vi.fn();
    const middleware = authorize(['super_admin', 'admin']);
    const req = createMockReq({ userRole: 'admin' });

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('returns 403 when user role is not in allowed list', () => {
    const next = vi.fn();
    const middleware = authorize(['super_admin']);
    const req = createMockReq({ userRole: 'delivery_agent' });

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: 'Insufficient privileges' }),
    );
  });

  it('returns 401 when no session role exists', () => {
    const next = vi.fn();
    const middleware = authorize(['super_admin']);
    const req = createMockReq({});

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it('allows super_admin access to super_admin-only routes', () => {
    const next = vi.fn();
    const middleware = authorize(['super_admin']);
    const req = createMockReq({ userRole: 'super_admin' });

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('denies read_only user from admin routes', () => {
    const next = vi.fn();
    const middleware = authorize(['super_admin', 'admin']);
    const req = createMockReq({ userRole: 'read_only' });

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it('denies billing_staff from delivery_agent routes', () => {
    const next = vi.fn();
    const middleware = authorize(['delivery_agent']);
    const req = createMockReq({ userRole: 'billing_staff' });

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
  });
});
