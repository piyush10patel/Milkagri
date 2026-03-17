import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

const mockFindMany = vi.fn();
const mockCreate = vi.fn();
vi.mock('../../index.js', () => ({
  prisma: {
    subscription: { findMany: (...args: any[]) => mockFindMany(...args) },
    deliveryOrder: { create: (...args: any[]) => mockCreate(...args) },
  },
  redis: {},
}));

const mockIsSystemHoliday = vi.fn();
const mockIsRouteHoliday = vi.fn();
vi.mock('../holidays/holidays.service.js', () => ({
  isSystemHoliday: (...args: any[]) => mockIsSystemHoliday(...args),
  isRouteHoliday: (...args: any[]) => mockIsRouteHoliday(...args),
}));

const mockApplyPendingQuantityChanges = vi.fn();
vi.mock('../subscriptions/subscriptions.service.js', () => ({
  applyPendingQuantityChanges: (...args: any[]) => mockApplyPendingQuantityChanges(...args),
}));

import { generateOrdersForDate } from './orders.service.js';

function dateFromOffset(offset: number): Date {
  const d = new Date(2020, 0, 1);
  d.setDate(d.getDate() + offset);
  return d;
}

let createCallArgs: any[] = [];

function setupDefaultMocks() {
  mockApplyPendingQuantityChanges.mockResolvedValue(0);
  createCallArgs = [];
  mockCreate.mockImplementation(async (args: any) => {
    createCallArgs.push(args);
    return { id: `order-${createCallArgs.length}` };
  });
}

function makeSub(o: {
  id?: string; customerId?: string; productVariantId?: string;
  customerStatus?: 'active' | 'paused' | 'stopped'; routeId?: string | null;
  frequencyType?: 'daily' | 'alternate_day' | 'custom_weekday';
  startDate?: Date; weekdays?: number[]; endDate?: Date | null;
  vacationHolds?: { startDate: Date; endDate: Date; resumedAt: Date | null }[];
}) {
  return {
    id: o.id ?? 'sub-1', customerId: o.customerId ?? 'cust-1',
    productVariantId: o.productVariantId ?? 'variant-1', quantity: 2,
    frequencyType: o.frequencyType ?? 'daily', weekdays: o.weekdays ?? [],
    startDate: o.startDate ?? new Date(2019, 0, 1), endDate: o.endDate ?? null,
    status: 'active',
    customer: { id: o.customerId ?? 'cust-1', status: o.customerStatus ?? 'active', routeId: o.routeId ?? null },
    vacationHolds: o.vacationHolds ?? [],
    productVariant: { id: o.productVariantId ?? 'variant-1', product: { name: 'Milk' } },
  };
}

// Property 9: No orders for paused/stopped customers (Req 6.4)
describe('Property 9: No orders for paused/stopped customers', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaultMocks(); });

  it('never creates orders for customers whose status is paused or stopped', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 3000 }).map(dateFromOffset),
        fc.constantFrom('paused' as const, 'stopped' as const),
        fc.integer({ min: 1, max: 5 }),
        async (targetDate, badStatus, subCount) => {
          mockIsSystemHoliday.mockResolvedValue(false);
          mockIsRouteHoliday.mockResolvedValue(false);
          createCallArgs = [];
          const subs = [];
          for (let i = 0; i < subCount; i++) {
            subs.push(makeSub({ id: `sub-bad-${i}`, customerId: `cust-bad-${i}`, customerStatus: badStatus }));
          }
          subs.push(makeSub({ id: 'sub-good', customerId: 'cust-good', customerStatus: 'active' }));
          mockFindMany.mockResolvedValue(subs);
          const result = await generateOrdersForDate(targetDate);
          for (const call of createCallArgs) {
            expect(call.data.customerId).not.toMatch(/^cust-bad-/);
          }
          expect(result.totalCreated).toBe(1);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// Property 10: No orders on system-wide holidays (Req 6.6)
describe('Property 10: No orders on system-wide holidays', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaultMocks(); });

  it('returns empty summary and never queries subscriptions on a system holiday', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 3650 }).map(dateFromOffset),
        async (targetDate) => {
          mockIsSystemHoliday.mockResolvedValue(true);
          const result = await generateOrdersForDate(targetDate);
          expect(result).toEqual({ totalCreated: 0, byRoute: {}, byProductVariant: {} });
          expect(mockFindMany).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 200 },
    );
  });
});

// Property 11: No orders during active vacation holds (Req 6.3)
describe('Property 11: No orders during active vacation holds', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaultMocks(); });

  it('never creates orders for subscriptions whose vacation hold covers the target date', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 1, max: 60 }),
        fc.integer({ min: 0, max: 59 }),
        async (holdStartOffset, holdLength, targetWithinHold) => {
          mockIsSystemHoliday.mockResolvedValue(false);
          mockIsRouteHoliday.mockResolvedValue(false);
          createCallArgs = [];
          const holdStart = dateFromOffset(holdStartOffset);
          const holdEnd = dateFromOffset(holdStartOffset + holdLength);
          const clampedOffset = Math.min(targetWithinHold, holdLength);
          const targetDate = dateFromOffset(holdStartOffset + clampedOffset);
          const subWithHold = makeSub({
            id: 'sub-hold', customerId: 'cust-hold', customerStatus: 'active',
            vacationHolds: [{ startDate: holdStart, endDate: holdEnd, resumedAt: null }],
          });
          const subNoHold = makeSub({
            id: 'sub-free', customerId: 'cust-free', customerStatus: 'active', vacationHolds: [],
          });
          mockFindMany.mockResolvedValue([subWithHold, subNoHold]);
          const result = await generateOrdersForDate(targetDate);
          for (const call of createCallArgs) {
            expect(call.data.customerId).not.toBe('cust-hold');
          }
          expect(result.totalCreated).toBe(1);
          expect(createCallArgs).toHaveLength(1);
          expect(createCallArgs[0].data.customerId).toBe('cust-free');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('does not exclude subscriptions when vacation hold was resumed before target date', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 10, max: 60 }),
        async (holdStartOffset, holdLength) => {
          mockIsSystemHoliday.mockResolvedValue(false);
          mockIsRouteHoliday.mockResolvedValue(false);
          createCallArgs = [];
          const holdStart = dateFromOffset(holdStartOffset);
          const holdEnd = dateFromOffset(holdStartOffset + holdLength);
          const resumeOffset = holdStartOffset + Math.floor(holdLength / 2);
          const resumedAt = dateFromOffset(resumeOffset);
          const targetDate = dateFromOffset(resumeOffset + 1);
          const sub = makeSub({
            id: 'sub-resumed', customerId: 'cust-resumed', customerStatus: 'active',
            vacationHolds: [{ startDate: holdStart, endDate: holdEnd, resumedAt }],
          });
          mockFindMany.mockResolvedValue([sub]);
          const result = await generateOrdersForDate(targetDate);
          expect(result.totalCreated).toBe(1);
          expect(createCallArgs).toHaveLength(1);
          expect(createCallArgs[0].data.customerId).toBe('cust-resumed');
        },
      ),
      { numRuns: 200 },
    );
  });
});

// Property 12: No orders on route-specific holidays (Req 6.5)
describe('Property 12: No orders on route-specific holidays', () => {
  beforeEach(() => { vi.clearAllMocks(); setupDefaultMocks(); });

  it('never creates orders for subscriptions on a route with a holiday on the target date', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 3000 }).map(dateFromOffset),
        fc.integer({ min: 1, max: 4 }),
        async (targetDate, subCount) => {
          mockIsSystemHoliday.mockResolvedValue(false);
          createCallArgs = [];
          const holidayRouteId = 'route-holiday';
          const freeRouteId = 'route-free';
          mockIsRouteHoliday.mockImplementation(
            async (routeId: string) => routeId === holidayRouteId,
          );
          const subs = [];
          for (let i = 0; i < subCount; i++) {
            subs.push(makeSub({
              id: `sub-hol-${i}`, customerId: `cust-hol-${i}`,
              customerStatus: 'active', routeId: holidayRouteId,
            }));
          }
          subs.push(makeSub({
            id: 'sub-free', customerId: 'cust-free',
            customerStatus: 'active', routeId: freeRouteId,
          }));
          mockFindMany.mockResolvedValue(subs);
          const result = await generateOrdersForDate(targetDate);
          for (const call of createCallArgs) {
            expect(call.data.routeId).not.toBe(holidayRouteId);
          }
          expect(result.totalCreated).toBe(1);
          expect(createCallArgs).toHaveLength(1);
          expect(createCallArgs[0].data.customerId).toBe('cust-free');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('does not exclude subscriptions with no route assignment on route holidays', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 3000 }).map(dateFromOffset),
        async (targetDate) => {
          mockIsSystemHoliday.mockResolvedValue(false);
          mockIsRouteHoliday.mockResolvedValue(true);
          createCallArgs = [];
          const sub = makeSub({
            id: 'sub-no-route', customerId: 'cust-no-route',
            customerStatus: 'active', routeId: null,
          });
          mockFindMany.mockResolvedValue([sub]);
          const result = await generateOrdersForDate(targetDate);
          expect(mockIsRouteHoliday).not.toHaveBeenCalled();
          expect(result.totalCreated).toBe(1);
        },
      ),
      { numRuns: 200 },
    );
  });
});
