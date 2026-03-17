import { z } from 'zod';

// ---------------------------------------------------------------------------
// Order query schemas
// ---------------------------------------------------------------------------

export const orderQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  routeId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(['pending', 'delivered', 'skipped', 'failed', 'returned']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const createOneTimeOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  productVariantId: z.string().uuid('Invalid product variant ID'),
  routeId: z.string().uuid('Invalid route ID').optional(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Delivery date must be YYYY-MM-DD'),
  quantity: z.number().positive('Quantity must be positive'),
});

export const updateOrderSchema = z.object({
  quantity: z.number().positive('Quantity must be positive').optional(),
  deliveryNotes: z.string().optional(),
});

export const generateOrdersSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Target date must be YYYY-MM-DD'),
});

export const summaryQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type OrderQuery = z.infer<typeof orderQuerySchema>;
export type CreateOneTimeOrderInput = z.infer<typeof createOneTimeOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type GenerateOrdersInput = z.infer<typeof generateOrdersSchema>;
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
