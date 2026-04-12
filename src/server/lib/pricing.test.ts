import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockFindFirst = vi.fn();

vi.mock('../index.js', () => ({
  prisma: {
    productPrice: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
    },
  },
  redis: {},
}));

import { getEffectivePrice } from './pricing.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Date from a day offset relative to a base date (2020-01-01). */
function dateFromOffset(offset: number): Date {
  const d = new Date(2020, 0, 1);
  d.setDate(d.getDate() + offset);
  return d;
}

/** Simulate what Prisma's findFirst with orderBy effectiveDate desc + lte filter does. */
function findMostRecentPrice(
  prices: { effectiveDate: Date; price: number; branch: string | null; pricingCategory?: string | null }[],
  targetDate: Date,
  branch: string | null,
  pricingCategory?: string | null,
) {
  return prices
    .filter((p) => {
      if (p.branch !== branch) return false;
      if (p.effectiveDate > targetDate) return false;
      // Match pricingCategory: undefined means "not filtered", null means "must be null"
      const pCat = p.pricingCategory ?? null;
      const filterCat = pricingCategory ?? null;
      return pCat === filterCat;
    })
    .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime())[0] ?? null;
}

const PRODUCT_ID = 'product-1';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a price entry with an effective date offset and a positive price. */
const priceEntryArb = (branch: string | null, pricingCategory?: string | null) =>
  fc.record({
    effectiveDate: fc.integer({ min: 0, max: 3650 }).map(dateFromOffset),
    price: fc.integer({ min: 1, max: 100000 }).map((n) => n / 100),
    branch: fc.constant(branch),
    pricingCategory: fc.constant(pricingCategory ?? null),
  });

/** Generate a non-empty array of default price entries. */
const defaultPriceHistoryArb = fc.array(priceEntryArb(null), { minLength: 1, maxLength: 20 });

/** Generate a target date as an offset. */
const targetDateArb = fc.integer({ min: 0, max: 3650 }).map(dateFromOffset);

// ---------------------------------------------------------------------------
// Property 1: Effective price lookup always returns the most recent price
//             on or before the target date.
// Validates: Requirements 4.4, 4.5
// ---------------------------------------------------------------------------
describe('Property 1: Most recent effective price is selected', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always returns the price with the greatest effectiveDate <= targetDate', async () => {
    await fc.assert(
      fc.asyncProperty(defaultPriceHistoryArb, targetDateArb, async (prices, targetDate) => {
        const expected = findMostRecentPrice(prices, targetDate, null);

        // Configure mock to simulate Prisma behavior
        mockFindFirst.mockImplementation(async (args: any) => {
          const branchFilter = args.where.branch;
          const catFilter = args.where.pricingCategory;
          return findMostRecentPrice(prices, targetDate, branchFilter ?? null, catFilter ?? null);
        });

        return getEffectivePrice(PRODUCT_ID, targetDate).then(
          (result) => {
            // If we got a result, it should match the expected price
            if (expected) {
              expect(result.price).toBe(expected.price);
              expect(result.effectiveDate.getTime()).toBe(expected.effectiveDate.getTime());
              // The effective date must be on or before the target date
              expect(result.effectiveDate <= targetDate).toBe(true);
            }
            return true;
          },
          (err) => {
            // Should only throw if no price exists on or before targetDate
            if (!expected) {
              expect(err.message).toContain('No effective price found');
              return true;
            }
            throw err;
          },
        );
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Future-dated prices are never applied before their effective date.
// Validates: Requirements 4.5
// ---------------------------------------------------------------------------
describe('Property 2: Future prices are never applied early', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never returns a price whose effectiveDate is after the target date', async () => {
    await fc.assert(
      fc.asyncProperty(defaultPriceHistoryArb, targetDateArb, async (prices, targetDate) => {
        mockFindFirst.mockImplementation(async (args: any) => {
          const branchFilter = args.where.branch;
          const catFilter = args.where.pricingCategory;
          return findMostRecentPrice(prices, targetDate, branchFilter ?? null, catFilter ?? null);
        });

        return getEffectivePrice(PRODUCT_ID, targetDate).then(
          (result) => {
            // The returned price's effective date must never be in the future
            expect(result.effectiveDate <= targetDate).toBe(true);
            return true;
          },
          (err) => {
            // Only acceptable error is "no price found"
            expect(err.message).toContain('No effective price found');
            return true;
          },
        );
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Branch override takes precedence over default price when
//             branch matches.
// Validates: Requirements 4.7
// ---------------------------------------------------------------------------
describe('Property 3: Branch override takes precedence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns branch price when available, default otherwise', async () => {
    const branchPriceHistoryArb = fc.array(priceEntryArb('branch-A'), {
      minLength: 0,
      maxLength: 10,
    });

    await fc.assert(
      fc.asyncProperty(
        defaultPriceHistoryArb,
        branchPriceHistoryArb,
        targetDateArb,
        async (defaultPrices, branchPrices, targetDate) => {
          const allPrices = [...defaultPrices, ...branchPrices];
          const expectedBranch = findMostRecentPrice(allPrices, targetDate, 'branch-A');
          const expectedDefault = findMostRecentPrice(allPrices, targetDate, null);

          mockFindFirst.mockImplementation(async (args: any) => {
            const branchFilter = args.where.branch;
            const catFilter = args.where.pricingCategory;
            return findMostRecentPrice(allPrices, targetDate, branchFilter ?? null, catFilter ?? null);
          });

          return getEffectivePrice(PRODUCT_ID, targetDate, 'branch-A').then(
            (result) => {
              if (expectedBranch) {
                // Branch price should take precedence
                expect(result.price).toBe(expectedBranch.price);
                expect(result.branch).toBe('branch-A');
              } else if (expectedDefault) {
                // Falls back to default
                expect(result.price).toBe(expectedDefault.price);
                expect(result.branch).toBeNull();
              }
              return true;
            },
            (err) => {
              // Only fails if neither branch nor default price exists
              expect(!expectedBranch && !expectedDefault).toBe(true);
              expect(err.message).toContain('No effective price found');
              return true;
            },
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: product-level-pricing, Property 10: Price resolution fallback order and most-recent-date selection
// Validates: Requirements 6.2, 6.4
// ---------------------------------------------------------------------------
describe('Property 10: Price resolution fallback order and most-recent-date selection', () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * Arbitrary: generate a set of ProductPrice records across various
   * branch / category / date combinations for a single product.
   */
  const branchArb = fc.oneof(fc.constant(null), fc.constant('branch-A'), fc.constant('branch-B'));
  const categoryArb = fc.oneof(fc.constant(null), fc.constant('cat-1'), fc.constant('cat-2'));

  const priceRecordArb = fc.record({
    effectiveDate: fc.integer({ min: 0, max: 3650 }).map(dateFromOffset),
    price: fc.integer({ min: 1, max: 100000 }).map((n) => n / 100),
    branch: branchArb,
    pricingCategory: categoryArb,
  });

  const priceSetArb = fc.array(priceRecordArb, { minLength: 1, maxLength: 30 });

  /** Reference implementation of the 4-step fallback. */
  function expectedFallback(
    prices: { effectiveDate: Date; price: number; branch: string | null; pricingCategory: string | null }[],
    targetDate: Date,
    branch: string | null,
    pricingCategory: string | null,
  ) {
    const steps: { branch: string | null; pricingCategory: string | null }[] = [];

    // Build fallback steps in order
    if (branch && pricingCategory) steps.push({ branch, pricingCategory });
    if (branch) steps.push({ branch, pricingCategory: null });
    if (pricingCategory) steps.push({ branch: null, pricingCategory });
    steps.push({ branch: null, pricingCategory: null });

    for (const step of steps) {
      const match = findMostRecentPrice(prices, targetDate, step.branch, step.pricingCategory);
      if (match) return match;
    }
    return null;
  }

  it('follows the 4-step fallback order and selects the most recent date <= targetDate', async () => {
    await fc.assert(
      fc.asyncProperty(
        priceSetArb,
        targetDateArb,
        branchArb,
        categoryArb,
        async (prices, targetDate, queryBranch, queryCategory) => {
          const expected = expectedFallback(prices, targetDate, queryBranch, queryCategory);

          mockFindFirst.mockImplementation(async (args: any) => {
            const branchFilter = args.where.branch;
            const catFilter = args.where.pricingCategory;
            return findMostRecentPrice(
              prices,
              targetDate,
              branchFilter ?? null,
              catFilter === undefined ? null : catFilter,
            );
          });

          return getEffectivePrice(PRODUCT_ID, targetDate, queryBranch, queryCategory).then(
            (result) => {
              // Must have found a match
              expect(expected).not.toBeNull();
              expect(result.price).toBe(expected!.price);
              expect(result.effectiveDate.getTime()).toBe(expected!.effectiveDate.getTime());
              expect(result.branch).toBe(expected!.branch);
              // Effective date must be on or before target date
              expect(result.effectiveDate <= targetDate).toBe(true);
              return true;
            },
            (err) => {
              // Should only throw if no fallback step matched
              expect(expected).toBeNull();
              expect(err.message).toContain('No effective price found');
              return true;
            },
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('never returns a record with effectiveDate > targetDate', async () => {
    await fc.assert(
      fc.asyncProperty(
        priceSetArb,
        targetDateArb,
        branchArb,
        categoryArb,
        async (prices, targetDate, queryBranch, queryCategory) => {
          mockFindFirst.mockImplementation(async (args: any) => {
            const branchFilter = args.where.branch;
            const catFilter = args.where.pricingCategory;
            return findMostRecentPrice(
              prices,
              targetDate,
              branchFilter ?? null,
              catFilter === undefined ? null : catFilter,
            );
          });

          return getEffectivePrice(PRODUCT_ID, targetDate, queryBranch, queryCategory).then(
            (result) => {
              expect(result.effectiveDate <= targetDate).toBe(true);
              return true;
            },
            (err) => {
              expect(err.message).toContain('No effective price found');
              return true;
            },
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
