import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Mutation schemas
// ---------------------------------------------------------------------------

export const recordInwardStockSchema = z.object({
  productVariantId: z.string().uuid(),
  quantity: z.number().positive('Quantity must be positive'),
  stockDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  supplierName: z.string().min(1).max(255),
});

export const recordWastageSchema = z.object({
  productVariantId: z.string().uuid(),
  quantity: z.number().positive('Quantity must be positive'),
  wastageDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  reason: z.string().min(1, 'Reason is required'),
});

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const stockQuerySchema = z.object({
  date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  productVariantId: z.string().uuid().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const stockDateParamSchema = z.object({
  date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type RecordInwardStockInput = z.infer<typeof recordInwardStockSchema>;
export type RecordWastageInput = z.infer<typeof recordWastageSchema>;
export type StockQuery = z.infer<typeof stockQuerySchema>;
