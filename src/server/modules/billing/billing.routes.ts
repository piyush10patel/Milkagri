import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import {
  generateInvoicesSchema,
  listInvoicesQuerySchema,
  invoiceIdParamSchema,
  addAdjustmentSchema,
  addDiscountSchema,
} from './billing.types.js';
import * as controller from './billing.controller.js';

const router = Router();

router.use(authenticate);

// POST /billing/generate
router.post(
  '/generate',
  authorize('billing'),
  csrfProtection,
  validate({ body: generateInvoicesSchema }),
  controller.generate,
);

// GET /billing/invoices
router.get(
  '/invoices',
  authorize('billing'),
  validate({ query: listInvoicesQuerySchema }),
  controller.listInvoices,
);

// GET /billing/invoices/:id
router.get(
  '/invoices/:id',
  authorize('billing'),
  validate({ params: invoiceIdParamSchema }),
  controller.getInvoice,
);

// GET /billing/invoices/:id/pdf
router.get(
  '/invoices/:id/pdf',
  authorize('billing'),
  validate({ params: invoiceIdParamSchema }),
  controller.getInvoicePdf,
);

// POST /billing/invoices/:id/adjustments
router.post(
  '/invoices/:id/adjustments',
  authorize('billing'),
  csrfProtection,
  validate({ params: invoiceIdParamSchema, body: addAdjustmentSchema }),
  controller.addAdjustment,
);

// POST /billing/invoices/:id/discounts
router.post(
  '/invoices/:id/discounts',
  authorize('billing'),
  csrfProtection,
  validate({ params: invoiceIdParamSchema, body: addDiscountSchema }),
  controller.addDiscount,
);

// POST /billing/invoices/:id/regenerate
router.post(
  '/invoices/:id/regenerate',
  authorize('billing'),
  csrfProtection,
  validate({ params: invoiceIdParamSchema }),
  controller.regenerateInvoice,
);

export default router;
