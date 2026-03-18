import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import {
  recordPaymentSchema,
  recordCollectionSchema,
  reconciliationQuerySchema,
  outstandingQuerySchema,
  listPaymentsQuerySchema,
} from './payments.types.js';
import * as controller from './payments.controller.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(['admin', 'billing_staff', 'super_admin']),
  validate({ query: listPaymentsQuerySchema }),
  controller.listPayments,
);

// POST /payments — Record payment (Billing_Staff, Super_Admin)
router.post(
  '/',
  authorize(['billing_staff', 'super_admin']),
  csrfProtection,
  validate({ body: recordPaymentSchema }),
  controller.recordPayment,
);

// POST /payments/collections — Record field collection (Delivery_Agent)
router.post(
  '/collections',
  authorize(['delivery_agent', 'super_admin']),
  csrfProtection,
  validate({ body: recordCollectionSchema }),
  controller.recordCollection,
);

// GET /payments/reconciliation?date=YYYY-MM-DD (Admin)
router.get(
  '/reconciliation',
  authorize(['admin', 'super_admin']),
  validate({ query: reconciliationQuerySchema }),
  controller.getReconciliation,
);

// GET /payments/outstanding (Admin, Billing_Staff)
router.get(
  '/outstanding',
  authorize(['admin', 'billing_staff', 'super_admin']),
  validate({ query: outstandingQuerySchema }),
  controller.getOutstanding,
);

export default router;
