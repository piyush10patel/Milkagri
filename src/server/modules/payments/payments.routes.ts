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
  authorize('payments'),
  validate({ query: listPaymentsQuerySchema }),
  controller.listPayments,
);

// POST /payments — Record payment (Billing_Staff, Super_Admin)
router.post(
  '/',
  authorize('payments'),
  csrfProtection,
  validate({ body: recordPaymentSchema }),
  controller.recordPayment,
);

// POST /payments/collections — Record field collection (Delivery_Agent)
router.post(
  '/collections',
  authorize('payments'),
  csrfProtection,
  validate({ body: recordCollectionSchema }),
  controller.recordCollection,
);

// GET /payments/reconciliation?date=YYYY-MM-DD (Admin)
router.get(
  '/reconciliation',
  authorize('payments'),
  validate({ query: reconciliationQuerySchema }),
  controller.getReconciliation,
);

// GET /payments/outstanding (Admin, Billing_Staff)
router.get(
  '/outstanding',
  authorize('payments'),
  validate({ query: outstandingQuerySchema }),
  controller.getOutstanding,
);

export default router;
