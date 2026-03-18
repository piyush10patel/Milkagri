import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ---------------------------------------------------------------------------
// POST /payments — Record a payment (Req 10.1, 10.2)
// ---------------------------------------------------------------------------
export const recordPaymentSchema = z.object({
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'other']),
  paymentMethodDescription: z.string().optional(),
  paymentDate: dateString,
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

// ---------------------------------------------------------------------------
// POST /payments/collections — Record field collection (Req 10.6)
// ---------------------------------------------------------------------------
export const recordCollectionSchema = z.object({
  customerId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'other']),
  paymentMethodDescription: z.string().optional(),
  paymentDate: dateString,
});

export type RecordCollectionInput = z.infer<typeof recordCollectionSchema>;

// ---------------------------------------------------------------------------
// GET /payments/reconciliation?date=YYYY-MM-DD (Req 10.8)
// ---------------------------------------------------------------------------
export const reconciliationQuerySchema = z.object({
  date: dateString,
});

export type ReconciliationQuery = z.infer<typeof reconciliationQuerySchema>;

// ---------------------------------------------------------------------------
// GET /payments/outstanding (Req 10.9)
// ---------------------------------------------------------------------------
export const outstandingQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(['outstanding', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type OutstandingQuery = z.infer<typeof outstandingQuerySchema>;

// ---------------------------------------------------------------------------
// GET /payments (history listing)
// ---------------------------------------------------------------------------
export const listPaymentsQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
