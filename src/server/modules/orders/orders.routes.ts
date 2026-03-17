import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  orderQuerySchema,
  createOneTimeOrderSchema,
  updateOrderSchema,
  generateOrdersSchema,
  summaryQuerySchema,
} from './orders.types.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import * as controller from './orders.controller.js';

const router = Router();

const adminPlus = ['super_admin', 'admin', 'billing_staff', 'read_only'];
const adminOnly = ['super_admin', 'admin'];

router.use(authenticate);

// GET /orders
router.get(
  '/',
  authorize(adminPlus),
  validate({ query: orderQuerySchema }),
  controller.list,
);

// GET /orders/summary
router.get(
  '/summary',
  authorize(adminPlus),
  validate({ query: summaryQuerySchema }),
  controller.summary,
);

// GET /orders/:id
router.get('/:id', authorize(adminPlus), validate({ params: uuidParamSchema }), controller.getById);

// POST /orders (one-time order)
router.post(
  '/',
  authorize(adminOnly),
  csrfProtection,
  validate({ body: createOneTimeOrderSchema }),
  auditLog(),
  controller.create,
);

// PUT /orders/:id
router.put(
  '/:id',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateOrderSchema }),
  auditLog(),
  controller.update,
);

// DELETE /orders/:id
router.delete(
  '/:id',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema }),
  auditLog(),
  controller.remove,
);

// POST /orders/generate (manual trigger — super_admin only)
router.post(
  '/generate',
  authorize(['super_admin']),
  csrfProtection,
  validate({ body: generateOrdersSchema }),
  controller.generate,
);

export default router;
