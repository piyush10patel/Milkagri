import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ---------------------------------------------------------------------------
// POST /agent-collections — Record a field collection (Req 2.1, 2.4)
// ---------------------------------------------------------------------------
export const recordAgentCollectionSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'other']),
  paymentDate: dateString,
});

export type RecordAgentCollectionInput = z.infer<typeof recordAgentCollectionSchema>;

// ---------------------------------------------------------------------------
// GET /agent-collections/summary?date=YYYY-MM-DD — Daily collection summary (Req 3.1, 4.1)
// ---------------------------------------------------------------------------
export const collectionSummaryQuerySchema = z.object({
  date: dateString,
});

export type CollectionSummaryQuery = z.infer<typeof collectionSummaryQuerySchema>;

// ---------------------------------------------------------------------------
// GET /agent-collections/dashboard?date=YYYY-MM-DD — Agent dashboard (Req 6.1)
// ---------------------------------------------------------------------------
export const agentDashboardQuerySchema = z.object({
  date: dateString.optional(),
});

export type AgentDashboardQuery = z.infer<typeof agentDashboardQuerySchema>;
