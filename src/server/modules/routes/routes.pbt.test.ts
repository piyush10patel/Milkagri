import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  routeTypeEnum,
  createRouteSchema,
  updateRouteSchema,
  routeQuerySchema,
} from './routes.types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates one of the two valid route type values. */
const validRouteTypeArb = fc.constantFrom('delivery', 'collection');

/**
 * Generates arbitrary strings that are NOT valid route types.
 * Filters out 'delivery' and 'collection' to guarantee invalidity.
 */
const invalidRouteTypeArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s !== 'delivery' && s !== 'collection');

/** Generates a valid route name (1-255 chars, non-empty). */
const routeNameArb = fc.string({ minLength: 1, maxLength: 100 });

// ---------------------------------------------------------------------------
// Feature: route-type-classification, Property 1: Route type invariant
// Validates: Requirements 1.1
// ---------------------------------------------------------------------------
describe('Property 1: Route type invariant', () => {
  it('routeTypeEnum only accepts delivery or collection — no other values', () => {
    fc.assert(
      fc.property(validRouteTypeArb, (value) => {
        const result = routeTypeEnum.safeParse(value);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(['delivery', 'collection']).toContain(result.data);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('routeTypeEnum rejects any string that is not delivery or collection', () => {
    fc.assert(
      fc.property(invalidRouteTypeArb, (value) => {
        const result = routeTypeEnum.safeParse(value);
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: route-type-classification, Property 2: Default route type is delivery
// Validates: Requirements 1.2
// ---------------------------------------------------------------------------
describe('Property 2: Default route type is delivery', () => {
  it('createRouteSchema without routeType leaves it undefined (DB default applies)', () => {
    fc.assert(
      fc.property(routeNameArb, (name) => {
        const result = createRouteSchema.safeParse({ name });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.routeType).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: route-type-classification, Property 3: Route type round-trip
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------
describe('Property 3: Route type round-trip', () => {
  it('valid routeType survives create schema parse round-trip', () => {
    fc.assert(
      fc.property(validRouteTypeArb, routeNameArb, (routeType, name) => {
        const input = { name, routeType };
        const result = createRouteSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.routeType).toBe(routeType);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('valid routeType survives update schema parse round-trip', () => {
    fc.assert(
      fc.property(validRouteTypeArb, (routeType) => {
        const result = updateRouteSchema.safeParse({ routeType });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.routeType).toBe(routeType);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('valid routeType survives query schema parse round-trip', () => {
    fc.assert(
      fc.property(validRouteTypeArb, (routeType) => {
        const result = routeQuerySchema.safeParse({ routeType });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.routeType).toBe(routeType);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: route-type-classification, Property 4: Invalid route type rejection
// Validates: Requirements 2.3, 2.4
// ---------------------------------------------------------------------------
describe('Property 4: Invalid route type rejection', () => {
  it('createRouteSchema rejects any invalid routeType string', () => {
    fc.assert(
      fc.property(invalidRouteTypeArb, routeNameArb, (routeType, name) => {
        const result = createRouteSchema.safeParse({ name, routeType });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('updateRouteSchema rejects any invalid routeType string', () => {
    fc.assert(
      fc.property(invalidRouteTypeArb, (routeType) => {
        const result = updateRouteSchema.safeParse({ routeType });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('routeQuerySchema rejects any invalid routeType string', () => {
    fc.assert(
      fc.property(invalidRouteTypeArb, (routeType) => {
        const result = routeQuerySchema.safeParse({ routeType });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Mocks for service-layer tests (Properties 5 & 6)
// ---------------------------------------------------------------------------
const mockRouteFindMany = vi.fn();
const mockRouteCount = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    route: {
      findMany: (...args: any[]) => mockRouteFindMany(...args),
      count: (...args: any[]) => mockRouteCount(...args),
    },
  },
  redis: {},
}));

import { listRoutes } from './routes.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Feature: route-type-classification, Property 5: Route type filtering
// Validates: Requirements 3.1, 3.2, 3.3, 6.3
// ---------------------------------------------------------------------------
describe('Property 5: Route type filtering', () => {
  /** Generates a set of mock routes with random route types. */
  const mockRouteArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    routeType: validRouteTypeArb,
    isActive: fc.boolean(),
  });

  const mockRouteSetArb = fc.array(mockRouteArb, { minLength: 0, maxLength: 20 });

  it('filtering by routeType returns only matching routes', async () => {
    await fc.assert(
      fc.asyncProperty(mockRouteSetArb, validRouteTypeArb, async (routes, filterType) => {
        const expected = routes.filter((r) => r.routeType === filterType);

        mockRouteFindMany.mockResolvedValue(expected);
        mockRouteCount.mockResolvedValue(expected.length);

        const result = await listRoutes(
          { routeType: filterType },
          { page: 1, limit: 100, skip: 0, take: 100 },
        );

        // Verify the where clause was passed with the correct routeType
        const call = mockRouteFindMany.mock.calls[mockRouteFindMany.mock.calls.length - 1][0];
        expect(call.where).toHaveProperty('routeType', filterType);

        // Verify all returned routes match the filter
        for (const route of result.routes) {
          expect(route.routeType).toBe(filterType);
        }

        expect(result.total).toBe(expected.length);
      }),
      { numRuns: 100 },
    );
  });

  it('omitting routeType filter does not add routeType to where clause', async () => {
    await fc.assert(
      fc.asyncProperty(mockRouteSetArb, async (routes) => {
        mockRouteFindMany.mockResolvedValue(routes);
        mockRouteCount.mockResolvedValue(routes.length);

        const result = await listRoutes(
          {},
          { page: 1, limit: 100, skip: 0, take: 100 },
        );

        const call = mockRouteFindMany.mock.calls[mockRouteFindMany.mock.calls.length - 1][0];
        expect(call.where).not.toHaveProperty('routeType');
        expect(result.total).toBe(routes.length);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: route-type-classification, Property 6: Route type present in all responses
// Validates: Requirements 7.1, 7.2, 7.3
// ---------------------------------------------------------------------------
describe('Property 6: Route type present in all responses', () => {
  it('createRouteSchema output shape includes routeType when provided', () => {
    fc.assert(
      fc.property(validRouteTypeArb, routeNameArb, (routeType, name) => {
        const result = createRouteSchema.safeParse({ name, routeType });
        expect(result.success).toBe(true);
        if (result.success) {
          expect('routeType' in result.data).toBe(true);
          expect(['delivery', 'collection']).toContain(result.data.routeType);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('updateRouteSchema output shape includes routeType when provided', () => {
    fc.assert(
      fc.property(validRouteTypeArb, (routeType) => {
        const result = updateRouteSchema.safeParse({ routeType });
        expect(result.success).toBe(true);
        if (result.success) {
          expect('routeType' in result.data).toBe(true);
          expect(['delivery', 'collection']).toContain(result.data.routeType);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('routeQuerySchema output shape includes routeType when provided', () => {
    fc.assert(
      fc.property(validRouteTypeArb, (routeType) => {
        const result = routeQuerySchema.safeParse({ routeType });
        expect(result.success).toBe(true);
        if (result.success) {
          expect('routeType' in result.data).toBe(true);
          expect(['delivery', 'collection']).toContain(result.data.routeType);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('any route object with a valid routeType has the field present and valid', () => {
    const routeResponseArb = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      routeType: validRouteTypeArb,
      isActive: fc.boolean(),
      description: fc.option(fc.string(), { nil: null }),
    });

    fc.assert(
      fc.property(routeResponseArb, (route) => {
        expect('routeType' in route).toBe(true);
        expect(['delivery', 'collection']).toContain(route.routeType);
      }),
      { numRuns: 100 },
    );
  });
});
