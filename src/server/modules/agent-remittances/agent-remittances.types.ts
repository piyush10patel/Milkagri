import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ---------------------------------------------------------------------------
// POST /agent-remittances — Record a remittance (Req 5.1, 5.2)
// ---------------------------------------------------------------------------
export const recordRemittanceSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID'),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'other']),
  remittanceDate: dateString,
  notes: z.string().optional(),
});

export type RecordRemittanceInput = z.infer<typeof recordRemittanceSchema>;

// ---------------------------------------------------------------------------
// GET /agent-remittances — List remittances (Req 5.6)
// ---------------------------------------------------------------------------
export const listRemittancesQuerySchema = z.object({
  agentId: z.string().uuid('Invalid agent ID').optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListRemittancesQuery = z.infer<typeof listRemittancesQuerySchema>;
