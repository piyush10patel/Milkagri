import { z } from 'zod';

export const createHandoverNoteSchema = z.object({
  noteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  content: z.string().min(1, 'Content is required').max(5000),
});

export const handoverQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateHandoverNoteInput = z.infer<typeof createHandoverNoteSchema>;
export type HandoverQuery = z.infer<typeof handoverQuerySchema>;
