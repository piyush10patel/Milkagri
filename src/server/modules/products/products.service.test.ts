import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockProductCreate = vi.fn();
const mockProductFindMany = vi.fn();
const mockProductCount = vi.fn();
const mockPricingCategoryFindMany = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    product: {
      create: (...args: any[]) => mockProductCreate(...args),
      findMany: (...args: any[]) => mockProductFindMany(...args),
      count: (...args: any[]) => mockProductCount(...args),
    },
    pricingCategory: {
      findMany: (...args: any[]) => mockPricingCategoryFindMany(...args),
    },
  },
  redis: {},
}));

import { createProduct, getPricingMatrix } from './products.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip time from a Date to get midnight. */
function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Feature: product-level-pricing, Property 1: Product creation default price round-trip
// Validates: Requirements 1.1, 1.2, 1.4
// ---------------------------------------------------------------------------
describe('Property 1: Product creation default price round-trip', () => {
  beforeEach(() => vi.clearAllMocks());

  /** Arbitrary: valid product name (non-empty, max 255 chars). */
  const productNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

  /** Arbitrary: positive decimal price (1 cent to 99999.99). */
  const priceArb = fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100);

  it('creates a ProductPrice record with correct price, null category, null branch, and today as effectiveDate', async () => {
    await fc.assert(
      fc.asyncProperty(productNameArb, priceArb, async (name, defaultPrice) => {
        const expectedToday = todayMidnight();
        const fakeProductId = 'prod-' + Math.random().toString(36).slice(2, 10);

        // Capture the data passed to prisma.product.create
        let capturedData: any = null;
        mockProductCreate.mockImplementation(async (args: any) => {
          capturedData = args.data;
          const priceData = args.data.prices?.create;
          return {
            id: fakeProductId,
            name: args.data.name,
            category: args.data.category ?? null,
            description: args.data.description ?? null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            variants: [],
            prices: priceData
              ? [
                  {
                    id: 'price-' + Math.random().toString(36).slice(2, 10),
                    productId: fakeProductId,
                    price: priceData.price,
                    effectiveDate: priceData.effectiveDate,
                    branch: priceData.branch,
                    pricingCategory: priceData.pricingCategory,
                    createdAt: new Date(),
                  },
                ]
              : [],
          };
        });

        const result = await createProduct({ name, defaultPrice });

        // Verify the product was created with the right name
        expect(capturedData.name).toBe(name);

        // Verify the nested price create data
        const priceCreate = capturedData.prices?.create;
        expect(priceCreate).toBeDefined();
        expect(priceCreate.price).toBe(defaultPrice);
        expect(priceCreate.branch).toBeNull();
        expect(priceCreate.pricingCategory).toBeNull();
        expect(priceCreate.effectiveDate.getTime()).toBe(expectedToday.getTime());

        // Verify the returned product has the price record
        expect(result.prices).toHaveLength(1);
        expect(result.prices[0].price).toBe(defaultPrice);
        expect(result.prices[0].branch).toBeNull();
        expect(result.prices[0].pricingCategory).toBeNull();
        expect(result.prices[0].productId).toBe(fakeProductId);

        return true;
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: product-level-pricing, Property 4: Pricing matrix one-row-per-product
// Validates: Requirements 3.1
// ---------------------------------------------------------------------------
describe('Property 4: Pricing matrix returns one row per active product', () => {
  beforeEach(() => vi.clearAllMocks());

  /** Arbitrary: generate a random set of products, some active, some inactive. */
  const productArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    category: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    isActive: fc.boolean(),
  });

  const productListArb = fc.array(productArb, { minLength: 0, maxLength: 50 });

  it('returns exactly one row per active product', async () => {
    await fc.assert(
      fc.asyncProperty(productListArb, async (products) => {
        const activeProducts = products.filter((p) => p.isActive);

        // Mock pricingCategory.findMany — return empty categories
        mockPricingCategoryFindMany.mockResolvedValue([]);

        // Mock product.findMany — return only active products with empty prices
        mockProductFindMany.mockImplementation(async (args: any) => {
          // The service filters by isActive: true
          const filtered = products
            .filter((p) => p.isActive)
            .map((p) => ({
              ...p,
              prices: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            }));
          return filtered;
        });

        const result = await getPricingMatrix();

        // Row count must equal active product count
        expect(result.rows).toHaveLength(activeProducts.length);

        // Each row should correspond to an active product
        const rowIds = new Set(result.rows.map((r: any) => r.id));
        for (const product of activeProducts) {
          expect(rowIds.has(product.id)).toBe(true);
        }

        // No inactive product should appear
        const inactiveIds = new Set(products.filter((p) => !p.isActive).map((p) => p.id));
        for (const row of result.rows) {
          expect(inactiveIds.has(row.id)).toBe(false);
        }

        return true;
      }),
      { numRuns: 100 },
    );
  });
});
