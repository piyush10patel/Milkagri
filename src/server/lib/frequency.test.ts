import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { shouldDeliverOnDate, type FrequencyInput } from './frequency.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Date from a day offset relative to 2020-01-01. */
function dateFromOffset(offset: number): Date {
  const d = new Date(2020, 0, 1);
  d.setDate(d.getDate() + offset);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const startDateArb = fc.integer({ min: 0, max: 1825 }).map(dateFromOffset);
const targetDateArb = fc.integer({ min: 0, max: 3650 }).map(dateFromOffset);

/** Non-empty subset of weekdays 0-6. */
const weekdaysArb = fc
  .subarray([0, 1, 2, 3, 4, 5, 6], { minLength: 1, maxLength: 7 })
  .map((arr) => arr.sort());

// ---------------------------------------------------------------------------
// Property 4: Daily subscriptions generate an order for every date within
//             their active range.
// Validates: Requirements 5.2, 6.2
// ---------------------------------------------------------------------------
describe('Property 4: Daily subscriptions deliver every day', () => {
  it('returns true for every date on or after startDate', () => {
    fc.assert(
      fc.property(startDateArb, targetDateArb, (startDate, targetDate) => {
        const sub: FrequencyInput = {
          frequencyType: 'daily',
          startDate,
          weekdays: [],
        };
        const result = shouldDeliverOnDate(sub, targetDate);
        const diff = daysBetween(startDate, targetDate);

        if (diff < 0) {
          expect(result).toBe(false);
        } else {
          expect(result).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Alternate-day subscriptions generate orders on exactly every
//             other day from start date.
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------
describe('Property 5: Alternate-day delivers every other day', () => {
  it('delivers when day difference from start is even, skips when odd', () => {
    fc.assert(
      fc.property(startDateArb, targetDateArb, (startDate, targetDate) => {
        const sub: FrequencyInput = {
          frequencyType: 'alternate_day',
          startDate,
          weekdays: [],
        };
        const result = shouldDeliverOnDate(sub, targetDate);
        const diff = daysBetween(startDate, targetDate);

        if (diff < 0) {
          expect(result).toBe(false);
        } else {
          expect(result).toBe(diff % 2 === 0);
        }
      }),
      { numRuns: 500 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Custom weekday subscriptions only generate orders on selected
//             weekdays.
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------
describe('Property 6: Custom weekday delivers only on selected days', () => {
  it('delivers only when targetDate weekday is in the selected weekdays', () => {
    fc.assert(
      fc.property(startDateArb, targetDateArb, weekdaysArb, (startDate, targetDate, weekdays) => {
        const sub: FrequencyInput = {
          frequencyType: 'custom_weekday',
          startDate,
          weekdays,
        };
        const result = shouldDeliverOnDate(sub, targetDate);
        const diff = daysBetween(startDate, targetDate);

        if (diff < 0) {
          expect(result).toBe(false);
        } else {
          const dayOfWeek = targetDate.getDay();
          expect(result).toBe(weekdays.includes(dayOfWeek));
        }
      }),
      { numRuns: 500 },
    );
  });
});


import { isOnVacationHold, type VacationHoldInput } from './frequency.js';

// ---------------------------------------------------------------------------
// Arbitraries for vacation holds
// ---------------------------------------------------------------------------

/** Generate a vacation hold with start <= end, and optional resumedAt. */
const vacationHoldArb = fc
  .tuple(
    fc.integer({ min: 0, max: 3000 }),
    fc.integer({ min: 0, max: 500 }),
  )
  .chain(([startOffset, duration]) => {
    const startDate = dateFromOffset(startOffset);
    const endDate = dateFromOffset(startOffset + duration);

    return fc.oneof(
      // Not resumed
      fc.constant({ startDate, endDate, resumedAt: null } as VacationHoldInput),
      // Resumed at some point within the hold range
      fc.integer({ min: 0, max: duration }).map((resumeOffset) => ({
        startDate,
        endDate,
        resumedAt: dateFromOffset(startOffset + resumeOffset),
      })),
    );
  });

// ---------------------------------------------------------------------------
// Property 7: Subscriptions with active vacation holds never generate orders
//             within the hold date range.
// Validates: Requirements 5.5, 6.3
// ---------------------------------------------------------------------------
describe('Property 7: Active vacation holds exclude orders in range', () => {
  it('returns true for dates within an un-resumed hold range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3000 }),
        fc.integer({ min: 0, max: 500 }),
        (startOffset, duration) => {
          const startDate = dateFromOffset(startOffset);
          const endDate = dateFromOffset(startOffset + duration);
          const hold: VacationHoldInput = { startDate, endDate, resumedAt: null };

          // Pick a random date within the hold range
          for (let d = 0; d <= duration; d++) {
            const target = dateFromOffset(startOffset + d);
            expect(isOnVacationHold([hold], target)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns false for dates outside the hold range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 3000 }),
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 100 }),
        (startOffset, duration, outsideOffset) => {
          const startDate = dateFromOffset(startOffset);
          const endDate = dateFromOffset(startOffset + duration);
          const hold: VacationHoldInput = { startDate, endDate, resumedAt: null };

          // Date before the hold
          const before = dateFromOffset(startOffset - outsideOffset);
          expect(isOnVacationHold([hold], before)).toBe(false);

          // Date after the hold
          const after = dateFromOffset(startOffset + duration + outsideOffset);
          expect(isOnVacationHold([hold], after)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Resumed vacation holds stop excluding orders from the resume
//             date onward.
// Validates: Requirements 5.6
// ---------------------------------------------------------------------------
describe('Property 8: Resumed holds stop excluding from resume date', () => {
  it('excludes dates before resumedAt but not on or after resumedAt', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3000 }),
        fc.integer({ min: 2, max: 500 }),
        (startOffset, duration) => {
          const startDate = dateFromOffset(startOffset);
          const endDate = dateFromOffset(startOffset + duration);
          // Resume in the middle of the hold
          const resumeOffset = Math.floor(duration / 2);
          const resumedAt = dateFromOffset(startOffset + resumeOffset);
          const hold: VacationHoldInput = { startDate, endDate, resumedAt };

          // Dates before resume should still be excluded (within hold range)
          if (resumeOffset > 0) {
            const beforeResume = dateFromOffset(startOffset + resumeOffset - 1);
            expect(isOnVacationHold([hold], beforeResume)).toBe(true);
          }

          // Date on resume date should NOT be excluded
          expect(isOnVacationHold([hold], resumedAt)).toBe(false);

          // Date after resume should NOT be excluded
          if (resumeOffset < duration) {
            const afterResume = dateFromOffset(startOffset + resumeOffset + 1);
            expect(isOnVacationHold([hold], afterResume)).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
