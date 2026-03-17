import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  RateLimiterStore,
  authRateLimiter,
  apiRateLimiter,
  authStore,
  apiStore,
  AUTH_MAX_REQUESTS,
  API_MAX_REQUESTS,
} from './rateLimiter.js';
import { RateLimitError } from '../lib/errors.js';

describe('RateLimiterStore', () => {
  let store: RateLimiterStore;

  beforeEach(() => {
    store = new RateLimiterStore(60_000);
  });

  afterEach(() => {
    store.destroy();
  });

  it('allows requests under the limit', () => {
    const result = store.check('key1', 5);
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
  });

  it('tracks request count per key', () => {
    store.check('key1', 5);
    store.check('key1', 5);
    const result = store.check('key1', 5);
    expect(result.count).toBe(3);
    expect(result.allowed).toBe(true);
  });

  it('blocks requests over the limit', () => {
    for (let i = 0; i < 5; i++) {
      store.check('key1', 5);
    }
    const result = store.check('key1', 5);
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(6);
  });

  it('isolates different keys', () => {
    for (let i = 0; i < 5; i++) {
      store.check('key1', 5);
    }
    const result = store.check('key2', 5);
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
  });

  it('resets after window expires', () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 5; i++) {
        store.check('key1', 5);
      }
      expect(store.check('key1', 5).allowed).toBe(false);

      // Advance past the window
      vi.advanceTimersByTime(60_001);

      const result = store.check('key1', 5);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('authRateLimiter middleware', () => {
  beforeEach(() => {
    // Reset the shared store between tests
    (authStore as any).store.clear();
  });

  function createReq(ip: string = '127.0.0.1'): Request {
    return {
      ip,
      headers: {},
      socket: { remoteAddress: ip },
    } as unknown as Request;
  }

  it('allows requests under the auth limit', () => {
    const req = createReq();
    const res = {} as Response;
    const next = vi.fn();

    authRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks requests over the auth limit', () => {
    const req = createReq('10.0.0.1');
    const res = {} as Response;
    const next = vi.fn();

    // Exhaust the limit
    for (let i = 0; i < AUTH_MAX_REQUESTS; i++) {
      const n = vi.fn();
      authRateLimiter(req, res, n);
    }

    // Next request should be blocked
    authRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(RateLimitError));
  });

  it('uses X-Forwarded-For header when present', () => {
    const req = {
      ip: '127.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    authRateLimiter(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('apiRateLimiter middleware', () => {
  beforeEach(() => {
    (apiStore as any).store.clear();
  });

  it('allows requests under the API limit', () => {
    const req = {
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      session: {},
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    apiRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('uses userId from session when available', () => {
    const req = {
      ip: '127.0.0.1',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      session: { userId: 'user-123' },
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    apiRateLimiter(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('blocks requests over the API limit', () => {
    const req = {
      ip: '10.0.0.2',
      headers: {},
      socket: { remoteAddress: '10.0.0.2' },
      session: { userId: 'user-flood' },
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn();

    for (let i = 0; i < API_MAX_REQUESTS; i++) {
      const n = vi.fn();
      apiRateLimiter(req, res, n);
    }

    apiRateLimiter(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(RateLimitError));
  });
});
