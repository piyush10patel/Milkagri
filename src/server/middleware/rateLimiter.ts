import type { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../lib/errors.js';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Simple in-memory sliding window rate limiter.
 * Uses a Map with periodic cleanup to prevent memory leaks.
 */
export class RateLimiterStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly windowMs: number) {}

  /**
   * Check if a key has exceeded the limit within the current window.
   * Returns the current count after incrementing.
   */
  hit(key: string): { count: number; remaining: number; limit: number; resetMs: number } & { limited: boolean } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      // Start a new window
      this.store.set(key, { count: 1, windowStart: now });
      return { count: 1, remaining: 0, limit: 0, resetMs: this.windowMs, limited: false };
    }

    entry.count += 1;
    const resetMs = this.windowMs - (now - entry.windowStart);
    return { count: entry.count, remaining: 0, limit: 0, resetMs, limited: false };
  }

  /**
   * Check and enforce rate limit. Returns true if the request should be allowed.
   */
  check(key: string, maxRequests: number): { allowed: boolean; count: number; resetMs: number } {
    const result = this.hit(key);
    return {
      allowed: result.count <= maxRequests,
      count: result.count,
      resetMs: result.resetMs,
    };
  }

  /**
   * Start periodic cleanup of expired entries.
   */
  startCleanup(intervalMs: number = 60_000): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store) {
        if (now - entry.windowStart >= this.windowMs) {
          this.store.delete(key);
        }
      }
    }, intervalMs);
    // Don't block process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop cleanup and clear the store.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }

  /** Visible for testing */
  get size(): number {
    return this.store.size;
  }
}

// Shared stores — one minute window
const WINDOW_MS = 60_000;
const authStore = new RateLimiterStore(WINDOW_MS);
const apiStore = new RateLimiterStore(WINDOW_MS);

// Start cleanup in non-test environments
if (process.env.NODE_ENV !== 'test') {
  authStore.startCleanup();
  apiStore.startCleanup();
}

const AUTH_MAX_REQUESTS = 100;
const API_MAX_REQUESTS = 1000;

/**
 * Get the client IP from the request, respecting X-Forwarded-For behind a proxy.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Rate limiter for authentication endpoints.
 * 100 requests per minute per IP address.
 */
export function authRateLimiter(req: Request, _res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const key = `auth:${ip}`;
  const result = authStore.check(key, AUTH_MAX_REQUESTS);

  if (!result.allowed) {
    next(new RateLimitError('Too many authentication requests. Please try again later.'));
    return;
  }

  next();
}

/**
 * Rate limiter for general API endpoints.
 * 1000 requests per minute per authenticated user (falls back to IP if unauthenticated).
 */
export function apiRateLimiter(req: Request, _res: Response, next: NextFunction): void {
  const userId = (req.session as any)?.userId;
  const key = userId ? `api:user:${userId}` : `api:ip:${getClientIp(req)}`;
  const result = apiStore.check(key, API_MAX_REQUESTS);

  if (!result.allowed) {
    next(new RateLimitError('Too many requests. Please try again later.'));
    return;
  }

  next();
}

// Export stores for testing
export { authStore, apiStore, AUTH_MAX_REQUESTS, API_MAX_REQUESTS, WINDOW_MS };
