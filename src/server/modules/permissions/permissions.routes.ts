import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { auditLog } from '../../middleware/auditLog.js';
import { updatePermissionSchema } from './permissions.types.js';
import * as controller from './permissions.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /permissions — return full permission matrix (super_admin only)
// ---------------------------------------------------------------------------
router.get('/', authorize('permissions'), controller.getMatrix);

// ---------------------------------------------------------------------------
// PUT /permissions — update a single permission (super_admin only)
// ---------------------------------------------------------------------------
router.put(
  '/',
  authorize('permissions'),
  csrfProtection,
  validate({ body: updatePermissionSchema }),
  auditLog(),
  controller.updatePermission,
);

// ---------------------------------------------------------------------------
// GET /permissions/me — return current user's granted permissions
// ---------------------------------------------------------------------------
router.get('/me', controller.getMyPermissions);

export default router;
