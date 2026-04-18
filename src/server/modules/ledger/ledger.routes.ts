import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../lib/validation.js';
import {
  ledgerQuerySchema,
  ledgerPdfQuerySchema,
  customerIdParamSchema,
} from './ledger.types.js';
import * as controller from './ledger.controller.js';

const router = Router();

router.use(authenticate);

// GET /customers/:id/ledger
router.get(
  '/:id/ledger',
  authorize('billing'),
  validate({ params: customerIdParamSchema, query: ledgerQuerySchema }),
  controller.getLedger,
);

// GET /customers/:id/ledger/pdf
router.get(
  '/:id/ledger/pdf',
  authorize('billing'),
  validate({ params: customerIdParamSchema, query: ledgerPdfQuerySchema }),
  controller.getLedgerPdf,
);

export default router;
