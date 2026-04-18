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

router.use(authenticate);

// GET /orders
router.get(
  '/',
  authorize('orders'),
  validate({ query: orderQuerySchema }),
  controller.list,
);

// GET /orders/summary
router.get(
  '/summary',
  authorize('orders'),
  validate({ query: summaryQuerySchema }),
  controller.summary,
);

router.get(
  '/milk-summary',
  authorize('orders'),
  validate({ query: summaryQuerySchema }),
  controller.milkSummary,
);

// GET /orders/:id
router.get('/:id', authorize('orders'), validate({ params: uuidParamSchema }), controller.getById);

// POST /orders (one-time order)
router.post(
  '/',
  authorize('orders'),
  csrfProtection,
  validate({ body: createOneTimeOrderSchema }),
  auditLog(),
  controller.create,
);

// PUT /orders/:id
router.put(
  '/:id',
  authorize('orders'),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateOrderSchema }),
  auditLog(),
  controller.update,
);

// DELETE /orders/:id
router.delete(
  '/:id',
  authorize('orders'),
  csrfProtection,
  validate({ params: uuidParamSchema }),
  auditLog(),
  controller.remove,
);

// POST /orders/generate (manual trigger)
router.post(
  '/generate',
  authorize('orders'),
  csrfProtection,
  validate({ body: generateOrdersSchema }),
  controller.generate,
);

export default router;
