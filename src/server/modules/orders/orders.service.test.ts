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
