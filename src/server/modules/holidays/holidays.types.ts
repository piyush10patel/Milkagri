import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Create schemas
// ---------------------------------------------------------------------------

export const createHolidaySchema = z.object({
  holidayDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  description: z.string().max(255).optional(),
  isSystemWide: z.boolean().default(true),
});

export const createRouteHolidaySchema = z.object({
  routeId: z.string().uuid(),
  holidayDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  description: z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const holidayQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  isSystemWide: z.enum(['true', 'false']).optional(),
  routeId: z.string().uuid().optional(),
});

export const holidayIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type CreateRouteHolidayInput = z.infer<typeof createRouteHolidaySchema>;
export type HolidayQuery = z.infer<typeof holidayQuerySchema>;
