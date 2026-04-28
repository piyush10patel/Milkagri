import { z } from 'zod';

export const milkCollectionDateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

export const agentCollectionDashboardQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

export const collectionRouteStopsQuerySchema = z.object({
  routeId: z.string().uuid('Invalid route ID'),
  deliverySession: z.enum(['morning', 'evening']),
});

export const saveCollectionRouteStopsSchema = z.object({
  routeId: z.string().uuid('Invalid route ID'),
  deliverySession: z.enum(['morning', 'evening']),
  stops: z.array(
    z.object({
      villageStopId: z.string().uuid('Invalid village stop ID'),
      sequenceOrder: z.number().int().min(1, 'Sequence order must be >= 1'),
      farmerIds: z.array(z.string().uuid('Invalid farmer ID')).optional().default([]),
    }),
  ),
});

export const assignCollectionRouteAgentsSchema = z.object({
  routeId: z.string().uuid('Invalid route ID'),
  agentIds: z.array(z.string().uuid('Invalid agent ID')),
});

export const collectionRouteManifestQuerySchema = z.object({
  routeId: z.string().uuid('Invalid route ID'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  deliverySession: z.enum(['morning', 'evening']),
});

export const createVillageSchema = z.object({
  name: z.string().trim().min(1, 'Village name is required').max(255, 'Village name is too long'),
});

export const createVillageStopSchema = z.object({
  villageId: z.string().uuid('Invalid village ID'),
  name: z.string().trim().min(1, 'Stop name is required').max(255, 'Stop name is too long'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  farmerIds: z.array(z.string().uuid('Invalid farmer ID')).optional().default([]),
});

export const updateVillageStopSchema = z.object({
  name: z.string().trim().min(1, 'Stop name is required').max(255, 'Stop name is too long').optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isActive: z.boolean().optional(),
  farmerIds: z.array(z.string().uuid('Invalid farmer ID')).optional(),
}).refine((value) => value.name !== undefined || value.latitude !== undefined || value.longitude !== undefined || value.isActive !== undefined || value.farmerIds !== undefined, {
  message: 'At least one field must be provided',
});

export const createFarmerSchema = z.object({
  villageId: z.string().uuid('Invalid village ID'),
  name: z.string().trim().min(1, 'Farmer name is required').max(255, 'Farmer name is too long'),
});

export const updateFarmerSchema = z.object({
  name: z.string().trim().min(1, 'Farmer name is required').max(255, 'Farmer name is too long').optional(),
  isActive: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.isActive !== undefined, {
  message: 'At least one field must be provided',
});

export const saveMilkCollectionSchema = z.object({
  villageId: z.string().uuid('Invalid village ID'),
  farmerId: z.string().uuid('Invalid farmer ID'),
  collectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Collection date must be YYYY-MM-DD'),
  deliverySession: z.enum(['morning', 'evening']),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().trim().max(2000, 'Notes are too long').optional().or(z.literal('')),
});

export const saveVillageIndividualCollectionSchema = z.object({
  villageId: z.string().uuid('Invalid village ID'),
  collectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Collection date must be YYYY-MM-DD'),
  deliverySession: z.enum(['morning', 'evening']),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().trim().max(2000, 'Notes are too long').optional().or(z.literal('')),
});

export const saveMilkVehicleLoadSchema = z.object({
  villageId: z.string().uuid('Invalid village ID'),
  loadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Load date must be YYYY-MM-DD'),
  deliverySession: z.enum(['morning', 'evening']),
  milkType: z.enum(['buffalo', 'cow']),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().trim().max(2000, 'Notes are too long').optional().or(z.literal('')),
});

export const saveMilkVehicleShiftLoadSchema = z.object({
  loadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Load date must be YYYY-MM-DD'),
  deliverySession: z.enum(['morning', 'evening']),
  milkType: z.enum(['buffalo', 'cow']),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().trim().max(2000, 'Notes are too long').optional().or(z.literal('')),
});

export type CreateVillageInput = z.infer<typeof createVillageSchema>;
export type CreateVillageStopInput = z.infer<typeof createVillageStopSchema>;
export type UpdateVillageStopInput = z.infer<typeof updateVillageStopSchema>;
export type CreateFarmerInput = z.infer<typeof createFarmerSchema>;
export type UpdateFarmerInput = z.infer<typeof updateFarmerSchema>;
export type SaveMilkCollectionInput = z.infer<typeof saveMilkCollectionSchema>;
export type SaveVillageIndividualCollectionInput = z.infer<typeof saveVillageIndividualCollectionSchema>;
export type SaveMilkVehicleLoadInput = z.infer<typeof saveMilkVehicleLoadSchema>;
export type SaveMilkVehicleShiftLoadInput = z.infer<typeof saveMilkVehicleShiftLoadSchema>;
export type CollectionRouteStopsQuery = z.infer<typeof collectionRouteStopsQuerySchema>;
export type SaveCollectionRouteStopsInput = z.infer<typeof saveCollectionRouteStopsSchema>;
export type CollectionRouteManifestQuery = z.infer<typeof collectionRouteManifestQuerySchema>;
export type AssignCollectionRouteAgentsInput = z.infer<typeof assignCollectionRouteAgentsSchema>;
export type AgentCollectionDashboardQuery = z.infer<typeof agentCollectionDashboardQuerySchema>;
