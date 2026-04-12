import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import { createHandoverNoteSchema, handoverQuerySchema } from './handover.types.js';
import * as controller from './handover.controller.js';

const router = Router();

router.use(authenticate);

const viewRoles = ['super_admin', 'admin', 'billing_staff', 'delivery_agent', 'read_only'];
const editRoles = ['super_admin', 'admin', 'billing_staff', 'delivery_agent'];

router.get('/', authorize(viewRoles), validate({ query: handoverQuerySchema }), controller.list);
router.post('/', authorize(editRoles), csrfProtection, validate({ body: createHandoverNoteSchema }), controller.create);
router.delete('/:id', authorize(editRoles), csrfProtection, validate({ params: uuidParamSchema }), controller.remove);

export default router;
