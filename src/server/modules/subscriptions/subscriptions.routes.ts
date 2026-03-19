import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  cancelSubscriptionSchema,
  createVacationHoldSchema,
  scheduleQuantityChangeSchema,
  subscriptionQuerySchema,
} from './subscriptions.types.js';
import { uuidParamSchema, uuidWithSubParam } from '../../lib/paramSchemas.js';
import * as controller from './subscriptions.controller.js';

const router = Router();

const adminPlus = ['super_admin', 'admin', 'billing_staff', 'read_only'];
const adminOnly = ['super_admin', 'admin'];

router.use(authenticate);

// GET /subscriptions
router.get(
  '/',
  authorize(adminPlus),
  validate({ query: subscriptionQuerySchema }),
  controller.list,
);

// GET /subscriptions/:id
router.get('/:id', authorize(adminPlus), validate({ params: uuidParamSchema }), controller.getById);

// POST /subscriptions
router.post(
  '/',
  authorize(adminOnly),
  csrfProtection,
  validate({ body: createSubscriptionSchema }),
  auditLog(),
  controller.create,
);

// PUT /subscriptions/:id
router.put(
  '/:id',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateSubscriptionSchema }),
  auditLog(),
  controller.update,
);

// DELETE /subscriptions/:id
router.delete(
  '/:id',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema }),
  auditLog(),
  controller.remove,
);

// PATCH /subscriptions/:id/cancel
router.patch(
  '/:id/cancel',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: cancelSubscriptionSchema }),
  auditLog(),
  controller.cancel,
);

// POST /subscriptions/:id/vacation-holds
router.post(
  '/:id/vacation-holds',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: createVacationHoldSchema }),
  auditLog(),
  controller.createVacationHold,
);

// PATCH /subscriptions/:id/vacation-holds/:hid/resume
router.patch(
  '/:id/vacation-holds/:hid/resume',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidWithSubParam('hid') }),
  auditLog(),
  controller.resumeVacationHold,
);

// POST /subscriptions/:id/quantity-changes
router.post(
  '/:id/quantity-changes',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: scheduleQuantityChangeSchema }),
  auditLog(),
  controller.scheduleQuantityChange,
);

// GET /subscriptions/:id/history
router.get('/:id/history', authorize(adminPlus), validate({ params: uuidParamSchema }), controller.getHistory);

export default router;
