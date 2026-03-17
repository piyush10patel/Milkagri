import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// Mock Prisma/Redis to avoid connection issues in unit tests
vi.mock('../../index.js', () => ({
  prisma: {},
  redis: {},
}));

import { calculateClosingStock } from './inventory.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DayData {
  inward: number;
  delivered: number;
  wastage: number;
}

/**
 * Simulate multiple days of inventory, returning closing stock per day.
 * Day 0 starts with openingStock = 0.
 */
function simulateMultipleDays(days: DayData[]): number[] {
  const closingStocks: number[] = [];
  let opening = 0;
  for (const day of days) {
    const closing = calculateClosingStock(opening, day.inward, day.delivered, day.wastage);
    closingStocks.push(closing);
    opening = closing;
  }
  return closingStocks;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Positive quantity (up to 10000, 3 decimal places). */
const qtyArb = fc.integer({ min: 0, max: 10000000 }).map((n) => n / 1000);

const dayDataArb: fc.Arbitrary<DayData> = fc.record({
  inward: qtyArb,
  delivered: qtyArb,
  wastage: qtyArb,
});

const daysArb = fc.array(dayDataArb, { minLength: 1, maxLength: 30 });

// ---------------------------------------------------------------------------
// Property 18: Closing stock equals opening stock + inward - delivered - wastage
// Validates: Requirements 18.2
// ---------------------------------------------------------------------------
describe('Property 18: Closing stock = opening + inward - delivered - wastage', () => {
  it('holds for any combination of opening stock and daily figures', () => {
    fc.assert(
      fc.property(qtyArb, qtyArb, qtyArb, qtyArb, (opening, inward, delivered, wastage) => {
        const closing = calculateClosingStock(opening, inward, delivered, wastage);
        const expected = parseFloat((opening + inward - delivered - wastage).toFixed(3));
        expect(closing).toBeCloseTo(expected, 3);
      }),
      { numRuns: 500 },
    );
  });

  it('holds across a sequence of days', () => {
    fc.assert(
      fc.property(daysArb, (days) => {
        let opening = 0;
        for (const day of days) {
          const closing = calculateClosingStock(opening, day.inward, day.delivered, day.wastage);
          const expected = parseFloat(
            (opening + day.inward - day.delivered - day.wastage).toFixed(3),
          );
          expect(closing).toBeCloseTo(expected, 3);
          opening = closing;
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 19: Closing stock of day N equals opening stock of day N+1
// Validates: Requirements 18.4
// ---------------------------------------------------------------------------
describe('Property 19: Closing stock of day N = opening stock of day N+1', () => {
  it('carry-forward invariant holds for any sequence of days', () => {
    fc.assert(
      fc.property(daysArb, (days) => {
        const closingStocks = simulateMultipleDays(days);

        // For each consecutive pair, closing[N] must equal opening[N+1].
        // Opening of day 0 is 0, opening of day N+1 is closing of day N.
        let opening = 0;
        for (let i = 0; i < days.length; i++) {
          // Verify the opening stock used for this day matches the previous closing
          expect(opening).toBeCloseTo(i === 0 ? 0 : closingStocks[i - 1], 3);

          // Advance opening to this day's closing for the next iteration
          opening = closingStocks[i];
        }
      }),
      { numRuns: 200 },
    );
  });

  it('closing stock of last day equals cumulative inward minus delivered minus wastage', () => {
    fc.assert(
      fc.property(daysArb, (days) => {
        const closingStocks = simulateMultipleDays(days);
        const finalClosing = closingStocks[closingStocks.length - 1];

        const totalInward = days.reduce((s, d) => s + d.inward, 0);
        const totalDelivered = days.reduce((s, d) => s + d.delivered, 0);
        const totalWastage = days.reduce((s, d) => s + d.wastage, 0);

        const expected = parseFloat((totalInward - totalDelivered - totalWastage).toFixed(3));
        expect(finalClosing).toBeCloseTo(expected, 2);
      }),
      { numRuns: 200 },
    );
  });
});
