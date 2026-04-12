import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Pure migration logic extracted from the SQL migration for testing.
//
// The SQL migration resolves conflicts when multiple variants of the same
// product have prices for the same (effectiveDate, branch, pricingCategory)
// by keeping the price from the earliest-created variant (by createdAt,
// with id as tiebreaker).
// ---------------------------------------------------------------------------

interface VariantPrice {
  id: string;
  variantId: string;
  productId: string;
  price: number;
  effectiveDate: string; // YYYY-MM-DD
  branch: string | null;
  pricingCategory: string | null;
  variantCreatedAt: Date;
}

interface ProductPrice {
  productId: string;
  price: number;
  effectiveDate: string;
  branch: string | null;
  pricingCategory: string | null;
}

/**
 * Simulate the migration logic: convert variant-level prices to product-level
 * prices. When multiple variants of the same product have prices for the same
 * (effectiveDate, branch, pricingCategory), keep the price from the variant
 * with the earliest createdAt (id as tiebreaker).
 */
function migrateVariantPricesToProductLevel(variantPrices: VariantPrice[]): ProductPrice[] {
  // Group by (productId, effectiveDate, branch, pricingCategory)
  const groups = new Map<string, VariantPrice[]>();

  for (const vp of variantPrices) {
    const key = `${vp.productId}|${vp.effectiveDate}|${vp.branch ?? ''}|${vp.pricingCategory ?? ''}`;
    const group = groups.get(key) ?? [];
    group.push(vp);
    groups.set(key, group);
  }

  const result: ProductPrice[] = [];

  for (const [, group] of groups) {
    // Pick the variant price from the earliest-created variant
    // Tiebreaker: lowest id
    group.sort((a, b) => {
      const timeDiff = a.variantCreatedAt.getTime() - b.variantCreatedAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    const winner = group[0];
    result.push({
      productId: winner.productId,
      price: winner.price,
      effectiveDate: winner.effectiveDate,
      branch: winner.branch,
      pricingCategory: winner.pricingCategory,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const productIdArb = fc.constantFrom('product-1', 'product-2', 'product-3');
const variantIdArb = fc.constantFrom('var-a', 'var-b', 'var-c', 'var-d');
const effectiveDateArb = fc.integer({ min: 0, max: 365 }).map((offset) => {
  const d = new Date(2024, 0, 1);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
});
const branchArb = fc.oneof(fc.constant(null), fc.constant('branch-A'), fc.constant('branch-B'));
const categoryArb = fc.oneof(fc.constant(null), fc.constant('cat-1'), fc.constant('cat-2'));
const priceValueArb = fc.integer({ min: 1, max: 100000 }).map((n) => n / 100);

const variantCreatedAtArb = fc.integer({ min: 0, max: 1000 }).map((offset) => {
  const d = new Date(2023, 0, 1);
  d.setDate(d.getDate() + offset);
  return d;
});

const variantPriceArb = fc.record({
  id: fc.uuid(),
  variantId: variantIdArb,
  productId: productIdArb,
  price: priceValueArb,
  effectiveDate: effectiveDateArb,
  branch: branchArb,
  pricingCategory: categoryArb,
  variantCreatedAt: variantCreatedAtArb,
});

const variantPriceSetArb = fc.array(variantPriceArb, { minLength: 1, maxLength: 30 });

// ---------------------------------------------------------------------------
// Feature: product-level-pricing, Property 13: Migration conflict resolution picks earliest variant
// Validates: Requirements 8.2
// ---------------------------------------------------------------------------
describe('Property 13: Migration conflict resolution picks earliest variant', () => {
  it('for conflicting variant prices, the price from the earliest-created variant wins', () => {
    fc.assert(
      fc.property(variantPriceSetArb, (variantPrices) => {
        const migrated = migrateVariantPricesToProductLevel(variantPrices);

        // For each migrated product price, verify it came from the earliest variant
        for (const mp of migrated) {
          // Find all variant prices that match this (productId, effectiveDate, branch, pricingCategory)
          const candidates = variantPrices.filter(
            (vp) =>
              vp.productId === mp.productId &&
              vp.effectiveDate === mp.effectiveDate &&
              (vp.branch ?? '') === (mp.branch ?? '') &&
              (vp.pricingCategory ?? '') === (mp.pricingCategory ?? ''),
          );

          expect(candidates.length).toBeGreaterThan(0);

          // Sort candidates by variantCreatedAt asc, then id asc (same as migration logic)
          candidates.sort((a, b) => {
            const timeDiff = a.variantCreatedAt.getTime() - b.variantCreatedAt.getTime();
            if (timeDiff !== 0) return timeDiff;
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
          });

          const earliest = candidates[0];
          expect(mp.price).toBe(earliest.price);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: product-level-pricing, Property 12: Migration preserves prices at product level
// Validates: Requirements 8.1, 8.3
// ---------------------------------------------------------------------------
describe('Property 12: Migration preserves prices at product level', () => {
  it('every unique (productId, effectiveDate, branch, pricingCategory) combination is migrated with preserved values', () => {
    fc.assert(
      fc.property(variantPriceSetArb, (variantPrices) => {
        const migrated = migrateVariantPricesToProductLevel(variantPrices);

        // Compute expected unique combinations from the input
        const expectedKeys = new Set<string>();
        for (const vp of variantPrices) {
          const key = `${vp.productId}|${vp.effectiveDate}|${vp.branch ?? ''}|${vp.pricingCategory ?? ''}`;
          expectedKeys.add(key);
        }

        // Migrated should have exactly one record per unique combination
        expect(migrated.length).toBe(expectedKeys.size);

        // Each migrated record should have a matching key
        const migratedKeys = new Set<string>();
        for (const mp of migrated) {
          const key = `${mp.productId}|${mp.effectiveDate}|${mp.branch ?? ''}|${mp.pricingCategory ?? ''}`;
          migratedKeys.add(key);

          // Verify preserved values: effectiveDate, branch, pricingCategory must come from original records
          const matchingOriginals = variantPrices.filter(
            (vp) =>
              vp.productId === mp.productId &&
              vp.effectiveDate === mp.effectiveDate &&
              (vp.branch ?? '') === (mp.branch ?? '') &&
              (vp.pricingCategory ?? '') === (mp.pricingCategory ?? ''),
          );

          expect(matchingOriginals.length).toBeGreaterThan(0);

          // effectiveDate, branch, pricingCategory are preserved from originals
          expect(mp.effectiveDate).toBe(matchingOriginals[0].effectiveDate);
          expect(mp.branch).toBe(matchingOriginals[0].branch);
          expect(mp.pricingCategory).toBe(matchingOriginals[0].pricingCategory);
        }

        // Every expected key should be present in migrated
        for (const key of expectedKeys) {
          expect(migratedKeys.has(key)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
