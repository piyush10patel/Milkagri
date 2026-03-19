import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import {
  createVillageSchema,
  milkCollectionDateQuerySchema,
  saveMilkCollectionSchema,
} from './milk-collections.types.js';
import * as controller from './milk-collections.controller.js';

const router = Router();

router.use(authenticate);

const viewRoles = ['super_admin', 'admin', 'billing_staff', 'read_only'];
const editRoles = ['super_admin', 'admin', 'billing_staff'];

router.get('/', authorize(viewRoles), validate({ query: milkCollectionDateQuerySchema }), controller.listSummary);
router.get('/villages', authorize(viewRoles), controller.listVillages);
router.post('/villages', authorize(editRoles), csrfProtection, validate({ body: createVillageSchema }), controller.createVillage);
router.post('/', authorize(editRoles), csrfProtection, validate({ body: saveMilkCollectionSchema }), controller.saveEntry);
router.delete('/:id', authorize(editRoles), csrfProtection, validate({ params: uuidParamSchema }), controller.removeEntry);

export default router;
