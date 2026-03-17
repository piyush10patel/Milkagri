/**
 * Pagination utilities for Prisma queries.
 *
 * Provides helpers to parse page/limit query params into Prisma-compatible
 * skip/take values and to wrap results in a standardised paginated response.
 */

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse raw page/limit values (typically from query params) into validated
 * pagination parameters with Prisma-compatible `skip` and `take`.
 */
export function parsePagination(
  rawPage?: string | number | null,
  rawLimit?: string | number | null,
): PaginationParams {
  let page = typeof rawPage === 'string' ? parseInt(rawPage, 10) : (rawPage ?? DEFAULT_PAGE);
  let limit = typeof rawLimit === 'string' ? parseInt(rawLimit, 10) : (rawLimit ?? DEFAULT_LIMIT);

  if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Build a standardised paginated response envelope.
 * Returns { data, pagination } format expected by the client.
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  params: PaginationParams,
): { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } } {
  return {
    data: items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit) || 0,
    },
  };
}
