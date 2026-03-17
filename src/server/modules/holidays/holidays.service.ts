import { prisma } from '../../index.js';
import type { Prisma } from '@prisma/client';
import type { PaginationParams } from '../../lib/pagination.js';
import type {
  CreateHolidayInput,
  CreateRouteHolidayInput,
  HolidayQuery,
} from './holidays.types.js';
import { AppError, NotFoundError } from '../../lib/errors.js';

/**
 * Add a system-wide holiday.
 */
export async function createHoliday(input: CreateHolidayInput, userId: string) {
  return prisma.holiday.create({
    data: {
      holidayDate: new Date(input.holidayDate),
      description: input.description ?? null,
      isSystemWide: input.isSystemWide ?? true,
      createdBy: userId,
    },
  });
}

/**
 * Add a route-specific non-delivery day.
 */
export async function createRouteHoliday(
  input: CreateRouteHolidayInput,
  userId: string,
) {
  // Verify route exists
  const route = await prisma.route.findUnique({ where: { id: input.routeId } });
  if (!route) throw new NotFoundError('Route not found');

  return prisma.routeHoliday.create({
    data: {
      routeId: input.routeId,
      holidayDate: new Date(input.holidayDate),
      description: input.description ?? null,
      createdBy: userId,
    },
  });
}

/**
 * Delete a future system-wide holiday. Only holidays with a date in the future
 * can be removed.
 */
export async function deleteHoliday(id: string) {
  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) throw new NotFoundError('Holiday not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (holiday.holidayDate < today) {
    throw new AppError('Cannot delete a past holiday', 400, 'BAD_REQUEST');
  }

  return prisma.holiday.delete({ where: { id } });
}

/**
 * Delete a future route-specific holiday.
 */
export async function deleteRouteHoliday(id: string) {
  const rh = await prisma.routeHoliday.findUnique({ where: { id } });
  if (!rh) throw new NotFoundError('Route holiday not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (rh.holidayDate < today) {
    throw new AppError('Cannot delete a past route holiday', 400, 'BAD_REQUEST');
  }

  return prisma.routeHoliday.delete({ where: { id } });
}


/**
 * Query system-wide holidays with optional date range filtering and pagination.
 */
export async function listHolidays(
  query: HolidayQuery,
  pagination: PaginationParams,
) {
  const where: Prisma.HolidayWhereInput = {};

  if (query.isSystemWide !== undefined) {
    where.isSystemWide = query.isSystemWide === 'true';
  }

  if (query.startDate || query.endDate) {
    where.holidayDate = {};
    if (query.startDate) where.holidayDate.gte = new Date(query.startDate);
    if (query.endDate) where.holidayDate.lte = new Date(query.endDate);
  }

  const [items, total] = await Promise.all([
    prisma.holiday.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { holidayDate: 'asc' },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.holiday.count({ where }),
  ]);

  return { items, total };
}

/**
 * Query route-specific holidays with optional date range and route filtering.
 */
export async function listRouteHolidays(
  query: HolidayQuery,
  pagination: PaginationParams,
) {
  const where: Prisma.RouteHolidayWhereInput = {};

  if (query.routeId) where.routeId = query.routeId;

  if (query.startDate || query.endDate) {
    where.holidayDate = {};
    if (query.startDate) where.holidayDate.gte = new Date(query.startDate);
    if (query.endDate) where.holidayDate.lte = new Date(query.endDate);
  }

  const [items, total] = await Promise.all([
    prisma.routeHoliday.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { holidayDate: 'asc' },
      include: {
        route: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.routeHoliday.count({ where }),
  ]);

  return { items, total };
}

/**
 * Check if a given date is a system-wide holiday.
 */
export async function isSystemHoliday(date: Date): Promise<boolean> {
  const count = await prisma.holiday.count({
    where: { holidayDate: date, isSystemWide: true },
  });
  return count > 0;
}

/**
 * Check if a given date is a route-specific holiday for a particular route.
 */
export async function isRouteHoliday(
  routeId: string,
  date: Date,
): Promise<boolean> {
  const count = await prisma.routeHoliday.count({
    where: { routeId, holidayDate: date },
  });
  return count > 0;
}
