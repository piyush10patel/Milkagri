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

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /customers — list (paginated, filterable)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authorize('customers'),
  validate({ query: customerQuerySchema }),
  controller.list,
);

router.post(
  '/reset-operational-data',
  authorize('customers'),
  csrfProtection,
  auditLog(),
  controller.resetOperationalData,
);

// ---------------------------------------------------------------------------
// GET /customers/:id — detail
// ---------------------------------------------------------------------------
router.get('/:id', authorize('customers'), validate({ params: uuidParamSchema }), controller.getById);

// ---------------------------------------------------------------------------
// POST /customers — create
// ---------------------------------------------------------------------------
router.post(
  '/',
  authorize('customers'),
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
  authorize('customers'),
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
  authorize('customers'),
  csrfProtection,
  validate({ params: uuidParamSchema, body: changeStatusSchema }),
  auditLog(),
  controller.changeStatus,
);

// ---------------------------------------------------------------------------
// GET /customers/:id/addresses — list addresses
// ---------------------------------------------------------------------------
router.get('/:id/addresses', authorize('customers'), validate({ params: uuidParamSchema }), controller.listAddresses);

// ---------------------------------------------------------------------------
// POST /customers/:id/addresses — add address
// ---------------------------------------------------------------------------
router.post(
  '/:id/addresses',
  authorize('customers'),
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
  authorize('customers'),
  csrfProtection,
  validate({ params: uuidWithSubParam('addrId'), body: updateAddressSchema }),
  auditLog(),
  controller.updateAddress,
);

export default router;
