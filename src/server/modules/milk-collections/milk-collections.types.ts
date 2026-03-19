import { z } from 'zod';

export const milkCollectionDateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

export const createVillageSchema = z.object({
  name: z.string().trim().min(1, 'Village name is required').max(255, 'Village name is too long'),
});

export const saveMilkCollectionSchema = z.object({
  villageId: z.string().uuid('Invalid village ID'),
  collectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Collection date must be YYYY-MM-DD'),
  deliverySession: z.enum(['morning', 'evening']),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().trim().max(2000, 'Notes are too long').optional().or(z.literal('')),
});

export type CreateVillageInput = z.infer<typeof createVillageSchema>;
export type SaveMilkCollectionInput = z.infer<typeof saveMilkCollectionSchema>;
