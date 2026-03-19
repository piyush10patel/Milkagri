import { z } from 'zod';

// ---------------------------------------------------------------------------
// Subscription schemas
// ---------------------------------------------------------------------------

export const createSubscriptionSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  productVariantId: z.string().uuid('Invalid product variant ID'),
  routeId: z.string().uuid('Invalid route ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  deliverySession: z.enum(['morning', 'evening']).default('morning'),
  frequencyType: z.enum(['daily', 'alternate_day', 'custom_weekday']),
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .optional()
    .default([]),
  packBreakdown: z
    .array(
      z.object({
        packSize: z.number().positive('Pack size must be positive'),
        packCount: z.number().int().positive('Pack count must be positive'),
      }),
    )
    .optional()
    .default([]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
});

export const updateSubscriptionSchema = z.object({
  routeId: z.string().uuid('Invalid route ID').nullable().optional(),
  quantity: z.number().positive('Quantity must be positive').optional(),
  deliverySession: z.enum(['morning', 'evening']).optional(),
  frequencyType: z.enum(['daily', 'alternate_day', 'custom_weekday']).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  packBreakdown: z
    .array(
      z.object({
        packSize: z.number().positive('Pack size must be positive'),
        packCount: z.number().int().positive('Pack count must be positive'),
      }),
    )
    .optional(),
});

export const cancelSubscriptionSchema = z.object({
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD')
    .optional(),
});

export const createVacationHoldSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
});

export const scheduleQuantityChangeSchema = z.object({
  newQuantity: z.number().positive('Quantity must be positive'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD'),
});

export const subscriptionQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  customerId: z.string().uuid().optional(),
  productVariantId: z.string().uuid().optional(),
  status: z.enum(['active', 'paused', 'cancelled']).optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type CreateVacationHoldInput = z.infer<typeof createVacationHoldSchema>;
export type ScheduleQuantityChangeInput = z.infer<typeof scheduleQuantityChangeSchema>;
export type SubscriptionQuery = z.infer<typeof subscriptionQuerySchema>;
