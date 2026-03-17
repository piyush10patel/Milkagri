import { z } from 'zod';

// ---------------------------------------------------------------------------
// Product schemas
// ---------------------------------------------------------------------------

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  category: z.string().max(100).optional(),
  description: z.string().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Variant schemas
// ---------------------------------------------------------------------------

const unitTypeEnum = z.enum(['liters', 'milliliters', 'packets', 'kilograms', 'pieces']);

export const createVariantSchema = z.object({
  unitType: unitTypeEnum,
  quantityPerUnit: z.number().positive('Quantity per unit must be positive'),
  sku: z.string().max(100).optional(),
});

export const updateVariantSchema = z.object({
  unitType: unitTypeEnum.optional(),
  quantityPerUnit: z.number().positive().optional(),
  sku: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Price schemas
// ---------------------------------------------------------------------------

export const addPriceSchema = z.object({
  price: z.number().positive('Price must be positive'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  branch: z.string().max(100).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const productQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['name', 'category', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const variantQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
});

export const priceHistoryQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type AddPriceInput = z.infer<typeof addPriceSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
export type VariantQuery = z.infer<typeof variantQuerySchema>;
