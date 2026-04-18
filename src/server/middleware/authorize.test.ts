import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock the permission service before importing authorize
vi.mock('../modules/permissions/permissions.service.js', () => ({
  hasPermission: vi.fn(),
}));

import { authorize } from './authorize.js';
import * as permissionService from '../modules/permissions/permissions.service.js';

const mockedHasPermission = vi.mocked(permissionService.hasPermission);

function createMockReq(session: Record<string, unknown> = {}): Request {
  return { session } as unknown as Request;
}

const mockRes = {} as Response;

describe('authorize middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next() for super_admin without DB lookup', async () => {
    const next = vi.fn();
    const middleware = authorize('customers');
    const req = createMockReq({ userRole: 'super_admin' });

    await middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockedHasPermission).not.toHaveBeenCalled();
  });

  it('returns 401 when no session role exists', async () => {
    const next = vi.fn();
    const middleware = authorize('customers');
    const req = createMockReq({});

    await middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it('calls next() when permission is granted', async () => {
    mockedHasPermission.mockResolvedValue(true);
    const next = vi.fn();
    const middleware = authorize('customers');
    const req = createMockReq({ userRole: 'admin' });

    await middleware(req, mockRes, next);

    expect(mockedHasPermission).toHaveBeenCalledWith('admin', 'customers');
    expect(next).toHaveBeenCalledWith();
  });

  it('returns 403 when permission is denied', async () => {
    mockedHasPermission.mockResolvedValue(false);
    const next = vi.fn();
    const middleware = authorize('users');
    const req = createMockReq({ userRole: 'delivery_agent' });

    await middleware(req, mockRes, next);

    expect(mockedHasPermission).toHaveBeenCalledWith('delivery_agent', 'users');
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, message: 'Insufficient privileges' }),
    );
  });

  it('returns 500 when permission service throws (fail-closed)', async () => {
    mockedHasPermission.mockRejectedValue(new Error('DB connection lost'));
    const next = vi.fn();
    const middleware = authorize('billing');
    const req = createMockReq({ userRole: 'billing_staff' });

    await middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, message: 'Permission check failed' }),
    );
  });

  it('passes the correct permission name to the service', async () => {
    mockedHasPermission.mockResolvedValue(true);
    const next = vi.fn();
    const middleware = authorize('reports');
    const req = createMockReq({ userRole: 'read_only' });

    await middleware(req, mockRes, next);

    expect(mockedHasPermission).toHaveBeenCalledWith('read_only', 'reports');
  });
});
