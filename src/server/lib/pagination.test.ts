import { describe, it, expect } from 'vitest';
import { parsePagination, paginatedResponse } from './pagination.js';

describe('parsePagination', () => {
  it('returns defaults when no arguments provided', () => {
    const result = parsePagination();
    expect(result).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });

  it('parses string page and limit', () => {
    const result = parsePagination('3', '10');
    expect(result).toEqual({ page: 3, limit: 10, skip: 20, take: 10 });
  });

  it('parses numeric page and limit', () => {
    const result = parsePagination(2, 15);
    expect(result).toEqual({ page: 2, limit: 15, skip: 15, take: 15 });
  });

  it('clamps page < 1 to default', () => {
    const result = parsePagination('0', '10');
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('clamps negative page to default', () => {
    const result = parsePagination('-5', '10');
    expect(result.page).toBe(1);
  });

  it('clamps limit < 1 to default', () => {
    const result = parsePagination('1', '0');
    expect(result.limit).toBe(20);
  });

  it('caps limit at 100', () => {
    const result = parsePagination('1', '500');
    expect(result.limit).toBe(100);
    expect(result.take).toBe(100);
  });

  it('handles NaN strings gracefully', () => {
    const result = parsePagination('abc', 'xyz');
    expect(result).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });

  it('handles null values', () => {
    const result = parsePagination(null, null);
    expect(result).toEqual({ page: 1, limit: 20, skip: 0, take: 20 });
  });
});

describe('paginatedResponse', () => {
  it('wraps items with pagination metadata', () => {
    const params = parsePagination('1', '10');
    const result = paginatedResponse(['a', 'b', 'c'], 25, params);

    expect(result).toEqual({
      items: ['a', 'b', 'c'],
      total: 25,
      page: 1,
      limit: 10,
      totalPages: 3,
    });
  });

  it('calculates totalPages correctly for exact division', () => {
    const params = parsePagination('1', '5');
    const result = paginatedResponse([], 20, params);
    expect(result.totalPages).toBe(4);
  });

  it('returns 0 totalPages when total is 0', () => {
    const params = parsePagination('1', '10');
    const result = paginatedResponse([], 0, params);
    expect(result.totalPages).toBe(0);
  });

  it('rounds up totalPages for partial last page', () => {
    const params = parsePagination('1', '10');
    const result = paginatedResponse([], 11, params);
    expect(result.totalPages).toBe(2);
  });
});
