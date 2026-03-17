import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from './validation.js';
import { ValidationError } from './errors.js';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

const mockRes = {} as Response;

describe('validate middleware', () => {
  it('calls next() when body passes validation', () => {
    const schema = z.object({ name: z.string() });
    const middleware = validate({ body: schema });
    const req = createMockReq({ body: { name: 'Alice' } });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Alice' });
  });

  it('strips unknown fields from body via Zod', () => {
    const schema = z.object({ name: z.string() }).strict();
    const middleware = validate({ body: schema });
    const req = createMockReq({ body: { name: 'Alice', extra: true } });
    const next = vi.fn();

    middleware(req, mockRes, next);

    // strict() causes validation failure for unknown keys
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it('calls next with ValidationError on body failure', () => {
    const schema = z.object({ email: z.string().email() });
    const middleware = validate({ body: schema });
    const req = createMockReq({ body: { email: 'not-an-email' } });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    const err = next.mock.calls[0][0] as ValidationError;
    expect(err.statusCode).toBe(400);
    expect(err.details).toHaveProperty('email');
  });

  it('validates query params with prefixed keys', () => {
    const schema = z.object({ page: z.string().regex(/^\d+$/) });
    const middleware = validate({ query: schema });
    const req = createMockReq({ query: { page: 'abc' } as any });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    const err = next.mock.calls[0][0] as ValidationError;
    expect(err.details).toHaveProperty('query.page');
  });

  it('validates params with prefixed keys', () => {
    const schema = z.object({ id: z.string().uuid() });
    const middleware = validate({ params: schema });
    const req = createMockReq({ params: { id: 'not-a-uuid' } as any });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    const err = next.mock.calls[0][0] as ValidationError;
    expect(err.details).toHaveProperty('params.id');
  });

  it('replaces req.query with parsed data on success', () => {
    const schema = z.object({ page: z.coerce.number().default(1) });
    const middleware = validate({ query: schema });
    const req = createMockReq({ query: {} as any });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 1 });
  });

  it('aggregates errors from body, query, and params', () => {
    const middleware = validate({
      body: z.object({ name: z.string().min(1) }),
      query: z.object({ page: z.string().regex(/^\d+$/) }),
      params: z.object({ id: z.string().uuid() }),
    });
    const req = createMockReq({
      body: { name: '' },
      query: { page: 'abc' } as any,
      params: { id: 'bad' } as any,
    });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    const err = next.mock.calls[0][0] as ValidationError;
    expect(Object.keys(err.details).length).toBeGreaterThanOrEqual(3);
  });

  it('passes through when no schemas provided', () => {
    const middleware = validate({});
    const req = createMockReq({ body: { anything: true } });
    const next = vi.fn();

    middleware(req, mockRes, next);

    expect(next).toHaveBeenCalledWith();
  });
});
