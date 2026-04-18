import { z } from 'zod';

// ---------------------------------------------------------------------------
// POST /agent-assignments — Assign customer to agent (Req 1.1)
// ---------------------------------------------------------------------------
export const assignCustomerSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  agentId: z.string().uuid('Invalid agent ID'),
});

export type AssignCustomerInput = z.infer<typeof assignCustomerSchema>;

// ---------------------------------------------------------------------------
// GET /agent-assignments — List assignments (Req 1.5, 1.7)
// ---------------------------------------------------------------------------
export const listAssignmentsQuerySchema = z.object({
  agentId: z.string().uuid('Invalid agent ID').optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
