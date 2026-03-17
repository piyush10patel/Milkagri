import { z } from 'zod';

// ---------------------------------------------------------------------------
// Route schemas
// ---------------------------------------------------------------------------

export const createRouteSchema = z.object({
  name: z.string().min(1, 'Route name is required').max(255),
  description: z.string().optional(),
});

export const updateRouteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

export const routeQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['name', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ---------------------------------------------------------------------------
// Customer assignment schemas
// ---------------------------------------------------------------------------

/** Assign / reorder customers on a route. Full replacement of the customer list. */
export const assignCustomersSchema = z.object({
  customers: z.array(
    z.object({
      customerId: z.string().uuid('Invalid customer ID'),
      sequenceOrder: z.number().int().min(1, 'Sequence order must be >= 1'),
    }),
  ).min(0),
});

// ---------------------------------------------------------------------------
// Agent assignment schema
// ---------------------------------------------------------------------------

export const assignAgentsSchema = z.object({
  agentIds: z.array(z.string().uuid('Invalid agent ID')),
});

// ---------------------------------------------------------------------------
// Manifest query
// ---------------------------------------------------------------------------

export const manifestQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type RouteQuery = z.infer<typeof routeQuerySchema>;
export type AssignCustomersInput = z.infer<typeof assignCustomersSchema>;
export type AssignAgentsInput = z.infer<typeof assignAgentsSchema>;
export type ManifestQuery = z.infer<typeof manifestQuerySchema>;
