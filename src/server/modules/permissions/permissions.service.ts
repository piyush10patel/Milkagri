import { prisma } from '../../index.js';
import {
  PERMISSION_NAMES,
  MANAGEABLE_ROLES,
  type PermissionName,
  type PermissionMatrix,
} from './permissions.types.js';

// ---------------------------------------------------------------------------
// In-memory cache: role → (permission → granted)
// ---------------------------------------------------------------------------

interface CacheEntry {
  permissions: Map<string, boolean>;
  loadedAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Default cache TTL in milliseconds (5 minutes). */
let cacheTTLMs = 5 * 60 * 1000;

/**
 * Set the cache TTL. Mainly useful for testing.
 */
export function setCacheTTL(ms: number): void {
  cacheTTLMs = ms;
}

/**
 * Clear the entire permission cache.
 */
export function invalidateCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.loadedAt < cacheTTLMs;
}

/**
 * Load all permissions for a role from the database and populate the cache.
 */
async function loadRolePermissions(role: string): Promise<Map<string, boolean>> {
  const records = await prisma.rolePermission.findMany({
    where: { role: role as any },
    select: { permission: true, granted: true },
  });

  const permMap = new Map<string, boolean>();

  // Default every permission to false (missing record = denied)
  for (const name of PERMISSION_NAMES) {
    permMap.set(name, false);
  }

  // Overlay DB records
  for (const rec of records) {
    permMap.set(rec.permission, rec.granted);
  }

  cache.set(role, { permissions: permMap, loadedAt: Date.now() });
  return permMap;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a role has a specific permission.
 * - super_admin always returns true without DB lookup.
 * - For other roles, checks cache first, then DB.
 */
export async function hasPermission(role: string, permission: string): Promise<boolean> {
  // super_admin bypass — always has full access
  if (role === 'super_admin') {
    return true;
  }

  // Check cache
  const entry = cache.get(role);
  if (entry && isCacheValid(entry)) {
    return entry.permissions.get(permission) ?? false;
  }

  // Cache miss or expired — load from DB
  const permMap = await loadRolePermissions(role);
  return permMap.get(permission) ?? false;
}

/**
 * Set (upsert) a permission for a role and invalidate the cache.
 */
export async function setPermission(
  role: string,
  permission: string,
  granted: boolean,
): Promise<void> {
  await prisma.rolePermission.upsert({
    where: {
      role_permission: {
        role: role as any,
        permission,
      },
    },
    update: { granted },
    create: {
      role: role as any,
      permission,
      granted,
    },
  });

  // Invalidate entire cache so next read is fresh
  invalidateCache();
}

/**
 * Return the array of granted permission names for a role.
 * super_admin returns all permission names.
 */
export async function getPermissionsForRole(role: string): Promise<string[]> {
  if (role === 'super_admin') {
    return [...PERMISSION_NAMES];
  }

  // Check cache
  const entry = cache.get(role);
  if (entry && isCacheValid(entry)) {
    return [...entry.permissions.entries()]
      .filter(([, granted]) => granted)
      .map(([name]) => name);
  }

  // Load from DB
  const permMap = await loadRolePermissions(role);
  return [...permMap.entries()]
    .filter(([, granted]) => granted)
    .map(([name]) => name);
}

/**
 * Return the full permission matrix for all manageable roles.
 * Each role key maps to an object with every permission name as a key.
 */
export async function getPermissionMatrix(): Promise<PermissionMatrix> {
  const matrix: PermissionMatrix = {};

  for (const role of MANAGEABLE_ROLES) {
    // Check cache first
    const entry = cache.get(role);
    let permMap: Map<string, boolean>;

    if (entry && isCacheValid(entry)) {
      permMap = entry.permissions;
    } else {
      permMap = await loadRolePermissions(role);
    }

    const rolePerms: { [permission: string]: boolean } = {};
    for (const name of PERMISSION_NAMES) {
      rolePerms[name] = permMap.get(name) ?? false;
    }
    matrix[role] = rolePerms;
  }

  return matrix;
}
