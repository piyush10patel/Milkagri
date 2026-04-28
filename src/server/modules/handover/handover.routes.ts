import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { ForbiddenError } from '../../lib/errors.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import { createHandoverNoteSchema, updateHandoverNoteSchema, handoverQuerySchema } from './handover.types.js';
import * as controller from './handover.controller.js';

const router = Router();

router.use(authenticate);

function requireAdminOrSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  const role = (req.session as any)?.userRole;
  if (role !== 'admin' && role !== 'super_admin') {
    return next(new ForbiddenError('Only admin and super admin can access handover notes'));
  }
  return next();
}

router.get('/', authorize('deliveries'), requireAdminOrSuperAdmin, validate({ query: handoverQuerySchema }), controller.list);
router.post('/', authorize('deliveries'), requireAdminOrSuperAdmin, csrfProtection, validate({ body: createHandoverNoteSchema }), controller.create);
router.put('/:id', authorize('deliveries'), requireAdminOrSuperAdmin, csrfProtection, validate({ params: uuidParamSchema, body: updateHandoverNoteSchema }), controller.update);
router.delete('/:id', authorize('deliveries'), requireAdminOrSuperAdmin, csrfProtection, validate({ params: uuidParamSchema }), controller.remove);

export default router;
