import { BillingFrequency } from '@prisma/client';

export interface BillingCycle {
  start: Date;
  end: Date;
}

/**
 * Number of days for fixed-length frequencies.
 * Monthly is handled separately (calendar month).
 */
const FREQUENCY_DAYS: Record<Exclude<BillingFrequency, 'monthly'>, number> = {
  daily: 1,
  next_day: 1,
  every_2_days: 2,
  weekly: 7,
  every_10_days: 10,
};

/** Strip time component — returns a Date at midnight UTC. */
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Return the last day of the calendar month containing `d` (UTC). */
function lastDayOfMonth(d: Date): Date {
  return utcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
}

/** Return the first day of the calendar month containing `d` (UTC). */
function firstDayOfMonth(d: Date): Date {
  return utcDate(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/**
 * Given a billing frequency and a reference date, compute the cycle that
 * contains that date.
 *
 * For fixed-length frequencies the cycle starts on the reference date itself.
 * For monthly the cycle spans the full calendar month of the reference date.
 */
export function getCycleForDate(
  frequency: BillingFrequency,
  referenceDate: Date,
): BillingCycle {
  if (frequency === 'monthly') {
    return {
      start: firstDayOfMonth(referenceDate),
      end: lastDayOfMonth(referenceDate),
    };
  }

  const days = FREQUENCY_DAYS[frequency];
  const start = utcDate(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );
  const end = utcDate(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate() + days - 1,
  );

  return { start, end };
}

/**
 * Given a customer's last cycle end date and their frequency, compute the
 * next billing cycle (the one that starts the day after `lastCycleEnd`).
 */
export function getNextCycle(
  frequency: BillingFrequency,
  lastCycleEnd: Date,
): BillingCycle {
  const nextStart = utcDate(
    lastCycleEnd.getUTCFullYear(),
    lastCycleEnd.getUTCMonth(),
    lastCycleEnd.getUTCDate() + 1,
  );

  return getCycleForDate(frequency, nextStart);
}

/**
 * Check whether a billing cycle has ended relative to a given "today" date.
 * A cycle is complete when `today` is strictly after the cycle end date.
 */
export function isCycleComplete(cycle: BillingCycle, today: Date): boolean {
  const todayNorm = utcDate(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return todayNorm.getTime() > cycle.end.getTime();
}
