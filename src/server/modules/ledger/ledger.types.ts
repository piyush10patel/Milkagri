import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ---------------------------------------------------------------------------
// GET /customers/:id/ledger  (query params)
// ---------------------------------------------------------------------------
export const ledgerQuerySchema = z.object({
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;

// ---------------------------------------------------------------------------
// GET /customers/:id/ledger/pdf  (query params)
// ---------------------------------------------------------------------------
export const ledgerPdfQuerySchema = z.object({
  startDate: dateString,
  endDate: dateString,
});

export type LedgerPdfQuery = z.infer<typeof ledgerPdfQuerySchema>;

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------
export const customerIdParamSchema = z.object({
  id: z.string().uuid(),
});
