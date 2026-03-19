import { z } from 'zod';

export const pricingCategoryQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
});

export const createPricingCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

export const updatePricingCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type PricingCategoryQuery = z.infer<typeof pricingCategoryQuerySchema>;
export type CreatePricingCategoryInput = z.infer<typeof createPricingCategorySchema>;
export type UpdatePricingCategoryInput = z.infer<typeof updatePricingCategorySchema>;
