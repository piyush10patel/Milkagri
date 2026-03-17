import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ---------------------------------------------------------------------------
// POST /billing/generate
// ---------------------------------------------------------------------------
export const generateInvoicesSchema = z.object({
  cycleStart: dateString,
  cycleEnd: dateString,
});

export type GenerateInvoicesInput = z.infer<typeof generateInvoicesSchema>;

// ---------------------------------------------------------------------------
// GET /billing/invoices  (query params)
// ---------------------------------------------------------------------------
export const listInvoicesQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid']).optional(),
  cycleStart: dateString.optional(),
  cycleEnd: dateString.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

// ---------------------------------------------------------------------------
// GET /billing/invoices/:id  (params)
// ---------------------------------------------------------------------------
export const invoiceIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// POST /billing/invoices/:id/adjustments  (stubbed for task 14.3)
// ---------------------------------------------------------------------------
export const addAdjustmentSchema = z.object({
  adjustmentType: z.enum(['credit', 'debit']),
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().min(1, 'Reason is required'),
});

export type AddAdjustmentInput = z.infer<typeof addAdjustmentSchema>;

// ---------------------------------------------------------------------------
// POST /billing/invoices/:id/discounts  (stubbed for task 14.3)
// ---------------------------------------------------------------------------
export const addDiscountSchema = z.object({
  discountType: z.enum(['percentage', 'fixed']),
  value: z.number().positive('Value must be positive'),
  description: z.string().optional(),
});

export type AddDiscountInput = z.infer<typeof addDiscountSchema>;
