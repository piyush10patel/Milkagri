import type { Request, Response, NextFunction } from 'express';
import * as permissionsService from './permissions.service.js';
import { PERMISSION_NAMES } from './permissions.types.js';
import { AppError } from '../../lib/errors.js';

// ---------------------------------------------------------------------------
// GET /permissions — return full permission matrix
// ---------------------------------------------------------------------------
export async function getMatrix(_req: Request, res: Response, next: NextFunction) {
  try {
    const matrix = await permissionsService.getPermissionMatrix();
    res.json({ data: matrix });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /permissions — update a single permission
// ---------------------------------------------------------------------------
export async function updatePermission(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req.session as any)?.userRole;

    // Defense-in-depth: only super_admin can update permissions
    if (userRole !== 'super_admin') {
      throw new AppError('Only super_admin can update permissions', 403, 'FORBIDDEN');
    }

    const { role, permission, granted } = req.body;

    // Reject updates targeting the super_admin role
    if (role === 'super_admin') {
      throw new AppError('super_admin permissions cannot be modified', 400, 'VALIDATION_ERROR');
    }

    await permissionsService.setPermission(role, permission, granted);
    permissionsService.invalidateCache();

    res.locals.audit = {
      actionType: 'update',
      entityType: 'role_permission',
      entityId: `${role}:${permission}`,
      changes: { permission: { old: !granted, new: granted } },
    };

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /permissions/me — return current user's granted permissions
// ---------------------------------------------------------------------------
export async function getMyPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req.session as any)?.userRole;

    if (userRole === 'super_admin') {
      res.json({ data: [...PERMISSION_NAMES] });
      return;
    }

    const permissions = await permissionsService.getPermissionsForRole(userRole);
    res.json({ data: permissions });
  } catch (err) {
    next(err);
  }
}
