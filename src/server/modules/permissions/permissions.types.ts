import { z } from 'zod';

// ---------------------------------------------------------------------------
// Permission names — fixed set matching platform features
// ---------------------------------------------------------------------------

export const PERMISSION_NAMES = [
  'customers', 'products', 'pricing', 'subscriptions', 'orders',
  'milk_summary', 'milk_collection', 'deliveries', 'routes',
  'route_map', 'live_gps', 'billing', 'payments', 'reports',
  'users', 'notifications', 'audit_logs', 'settings',
  'collections_overview', 'agent_assignments', 'remittances',
  'agent_balances', 'agent_collections_dashboard',
] as const;

export type PermissionName = typeof PERMISSION_NAMES[number];

// ---------------------------------------------------------------------------
// Manageable roles (excludes super_admin — always has full access)
// ---------------------------------------------------------------------------

export const MANAGEABLE_ROLES = ['admin', 'billing_staff', 'delivery_agent', 'read_only'] as const;

// ---------------------------------------------------------------------------
// Permission matrix interface
// ---------------------------------------------------------------------------

export interface PermissionMatrix {
  [role: string]: { [permission: string]: boolean };
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

export const updatePermissionSchema = z.object({
  role: z.enum(MANAGEABLE_ROLES),
  permission: z.enum(PERMISSION_NAMES),
  granted: z.boolean(),
});

export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;
