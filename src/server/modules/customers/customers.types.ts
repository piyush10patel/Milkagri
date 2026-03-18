import { z } from 'zod';

// ---------------------------------------------------------------------------
// Address schemas
// ---------------------------------------------------------------------------

export const createAddressSchema = z.object({
  addressLine1: z.string().min(1, 'Address line 1 is required').max(500),
  addressLine2: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isPrimary: z.boolean().optional(),
});

export const updateAddressSchema = z.object({
  addressLine1: z.string().min(1).max(500).optional(),
  addressLine2: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isPrimary: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Customer schemas
// ---------------------------------------------------------------------------

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  phone: z.string().min(1, 'Phone is required').max(20),
  email: z.string().email('Invalid email format').optional(),
  deliveryNotes: z.string().optional(),
  preferredDeliveryWindow: z.string().max(50).optional(),
  routeId: z.string().uuid('Invalid route ID').optional(),
  address: createAddressSchema.optional(),
  pricingCategory: z.enum(['cat_1', 'cat_2', 'cat_3']).optional(),
  billingFrequency: z.enum(['daily', 'every_2_days', 'weekly', 'every_10_days', 'monthly']).optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(20).optional(),
  email: z.string().email('Invalid email format').optional(),
  deliveryNotes: z.string().optional(),
  preferredDeliveryWindow: z.string().max(50).optional(),
  routeId: z.string().uuid('Invalid route ID').nullable().optional(),
  pricingCategory: z.enum(['cat_1', 'cat_2', 'cat_3']).optional(),
  billingFrequency: z.enum(['daily', 'every_2_days', 'weekly', 'every_10_days', 'monthly']).optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum(['active', 'paused', 'stopped']),
});

export const customerQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  status: z.enum(['active', 'paused', 'stopped']).optional(),
  routeId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'phone', 'status', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type CustomerQuery = z.infer<typeof customerQuerySchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
