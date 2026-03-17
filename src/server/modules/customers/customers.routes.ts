import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  changeStatusSchema,
  customerQuerySchema,
  createAddressSchema,
  updateAddressSchema,
} from './customers.types.js';
import { uuidParamSchema, uuidWithSubParam } from '../../lib/paramSchemas.js';
import * as controller from './customers.controller.js';

const router = Router();

const adminPlus = ['super_admin', 'admin', 'billing_staff', 'read_only'];
const adminOnly = ['super_admin', 'admin'];

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /customers — list (paginated, filterable)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authorize(adminPlus),
  validate({ query: customerQuerySchema }),
  controller.list,
);

// ---------------------------------------------------------------------------
// GET /customers/:id — detail
// ---------------------------------------------------------------------------
router.get('/:id', authorize(adminPlus), validate({ params: uuidParamSchema }), controller.getById);

// ---------------------------------------------------------------------------
// POST /customers — create
// ---------------------------------------------------------------------------
router.post(
  '/',
  authorize(adminOnly),
  csrfProtection,
  validate({ body: createCustomerSchema }),
  auditLog(),
  controller.create,
);

// ---------------------------------------------------------------------------
// PUT /customers/:id — update
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateCustomerSchema }),
  auditLog(),
  controller.update,
);

// ---------------------------------------------------------------------------
// PATCH /customers/:id/status — change status
// ---------------------------------------------------------------------------
router.patch(
  '/:id/status',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: changeStatusSchema }),
  auditLog(),
  controller.changeStatus,
);

// ---------------------------------------------------------------------------
// GET /customers/:id/addresses — list addresses
// ---------------------------------------------------------------------------
router.get('/:id/addresses', authorize(adminPlus), validate({ params: uuidParamSchema }), controller.listAddresses);

// ---------------------------------------------------------------------------
// POST /customers/:id/addresses — add address
// ---------------------------------------------------------------------------
router.post(
  '/:id/addresses',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: createAddressSchema }),
  auditLog(),
  controller.createAddress,
);

// ---------------------------------------------------------------------------
// PUT /customers/:id/addresses/:addrId — update address
// ---------------------------------------------------------------------------
router.put(
  '/:id/addresses/:addrId',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidWithSubParam('addrId'), body: updateAddressSchema }),
  auditLog(),
  controller.updateAddress,
);

export default router;
