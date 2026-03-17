/**
 * Core frequency matching logic for subscription delivery scheduling.
 *
 * Determines whether a delivery should occur on a given target date based
 * on the subscription's frequency type and configuration.
 */

export interface FrequencyInput {
  frequencyType: 'daily' | 'alternate_day' | 'custom_weekday';
  startDate: Date;
  weekdays: number[]; // 0-6 (Sun-Sat), used for custom_weekday
}

/**
 * Returns the number of whole days between two dates (ignoring time).
 * Both dates are treated as UTC-midnight to avoid timezone drift.
 */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

/**
 * Determine whether a subscription should generate a delivery on `targetDate`.
 *
 * Rules:
 * - **daily**: every day from startDate onward
 * - **alternate_day**: every other day from startDate (day diff is even)
 * - **custom_weekday**: only on selected weekdays (0 = Sun … 6 = Sat)
 *
 * Returns `false` if targetDate is before startDate.
 */
export function shouldDeliverOnDate(
  subscription: FrequencyInput,
  targetDate: Date,
): boolean {
  const diff = daysBetween(subscription.startDate, targetDate);

  // Target date is before subscription start
  if (diff < 0) return false;

  switch (subscription.frequencyType) {
    case 'daily':
      return true;

    case 'alternate_day':
      return diff % 2 === 0;

    case 'custom_weekday': {
      const dayOfWeek = targetDate.getDay(); // 0 = Sun … 6 = Sat
      return subscription.weekdays.includes(dayOfWeek);
    }

    default:
      return false;
  }
}


/**
 * Check whether a subscription has an active vacation hold covering `targetDate`.
 *
 * A hold is active if:
 * - targetDate >= hold.startDate AND targetDate <= hold.endDate
 * - AND the hold has NOT been resumed (resumedAt is null)
 *   OR the hold was resumed but targetDate < resumedAt
 */
export interface VacationHoldInput {
  startDate: Date;
  endDate: Date;
  resumedAt: Date | null;
}

export function isOnVacationHold(
  holds: VacationHoldInput[],
  targetDate: Date,
): boolean {
  for (const hold of holds) {
    const afterStart = targetDate >= hold.startDate;
    const beforeEnd = targetDate <= hold.endDate;

    if (!afterStart || !beforeEnd) continue;

    // Hold is not resumed — still active
    if (!hold.resumedAt) return true;

    // Hold was resumed — only covers dates before the resume date
    if (targetDate < hold.resumedAt) return true;
  }

  return false;
}

/**
 * Determine the effective date for a subscription change based on cutoff time.
 *
 * If the current time is after the cutoff, the change applies to the day
 * after the next delivery date (i.e., two days from now at the earliest).
 * Otherwise it applies from the next delivery date (tomorrow at the earliest).
 *
 * @param cutoffHour - Hour of day (0-23) representing the cutoff time
 * @param now - Current date/time
 * @returns The earliest date the change can take effect
 */
export function getEffectiveDateAfterCutoff(
  cutoffHour: number,
  now: Date = new Date(),
): Date {
  const currentHour = now.getHours();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (currentHour >= cutoffHour) {
    // After cutoff — skip next delivery, apply day after
    const dayAfterNext = new Date(tomorrow);
    dayAfterNext.setDate(dayAfterNext.getDate() + 1);
    return dayAfterNext;
  }

  return tomorrow;
}
