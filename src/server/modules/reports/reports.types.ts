import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ---------------------------------------------------------------------------
// Shared date-range + pagination query params
// ---------------------------------------------------------------------------
export const dateRangeQuerySchema = z.object({
  startDate: dateString,
  endDate: dateString,
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

// ---------------------------------------------------------------------------
// Route-wise delivery report — optional routeId filter
// ---------------------------------------------------------------------------
export const routeDeliveryQuerySchema = dateRangeQuerySchema.extend({
  routeId: z.string().uuid().optional(),
});

export type RouteDeliveryQuery = z.infer<typeof routeDeliveryQuerySchema>;

// ---------------------------------------------------------------------------
// Customer outstanding report — optional aging threshold
// ---------------------------------------------------------------------------
export const outstandingQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type OutstandingQuery = z.infer<typeof outstandingQuerySchema>;

// ---------------------------------------------------------------------------
// Revenue report — aggregation level
// ---------------------------------------------------------------------------
export const revenueQuerySchema = dateRangeQuerySchema.extend({
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

export type RevenueQuery = z.infer<typeof revenueQuerySchema>;

// ---------------------------------------------------------------------------
// CSV export param
// ---------------------------------------------------------------------------
export const csvExportParamSchema = z.object({
  type: z.enum([
    'daily-delivery',
    'route-delivery',
    'outstanding',
    'revenue',
    'product-sales',
    'missed-deliveries',
    'subscription-changes',
  ]),
});

export type CsvExportParam = z.infer<typeof csvExportParamSchema>;
