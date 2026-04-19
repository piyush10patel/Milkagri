import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import { createHandoverNoteSchema, updateHandoverNoteSchema, handoverQuerySchema } from './handover.types.js';
import * as controller from './handover.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('deliveries'), validate({ query: handoverQuerySchema }), controller.list);
router.post('/', authorize('deliveries'), csrfProtection, validate({ body: createHandoverNoteSchema }), controller.create);
router.put('/:id', authorize('deliveries'), csrfProtection, validate({ params: uuidParamSchema, body: updateHandoverNoteSchema }), controller.update);
router.delete('/:id', authorize('deliveries'), csrfProtection, validate({ params: uuidParamSchema }), controller.remove);

export default router;
