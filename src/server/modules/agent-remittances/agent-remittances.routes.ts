import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  recordRemittanceSchema,
  listRemittancesQuerySchema,
} from './agent-remittances.types.js';
import * as controller from './agent-remittances.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /agent-remittances — Record a remittance (Req 5.1)
// ---------------------------------------------------------------------------
router.post(
  '/',
  authorize('remittances'),
  csrfProtection,
  validate({ body: recordRemittanceSchema }),
  auditLog(),
  controller.recordRemittance,
);

// ---------------------------------------------------------------------------
// GET /agent-remittances — List remittances (Req 5.6)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authorize('remittances'),
  validate({ query: listRemittancesQuerySchema }),
  controller.listRemittances,
);

// ---------------------------------------------------------------------------
// GET /agent-remittances/balances — Get un-remitted balances (Req 8.2)
// ---------------------------------------------------------------------------
router.get(
  '/balances',
  authorize('remittances'),
  controller.getBalances,
);

export default router;
