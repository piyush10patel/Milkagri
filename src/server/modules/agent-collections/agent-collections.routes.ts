import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import {
  recordAgentCollectionSchema,
  collectionSummaryQuerySchema,
  agentDashboardQuerySchema,
} from './agent-collections.types.js';
import * as controller from './agent-collections.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /agent-collections — Record a field collection (Req 2.1)
// ---------------------------------------------------------------------------
router.post(
  '/',
  authorize('agent_collections_dashboard'),
  csrfProtection,
  validate({ body: recordAgentCollectionSchema }),
  controller.recordCollection,
);

// ---------------------------------------------------------------------------
// GET /agent-collections/summary?date=YYYY-MM-DD — Daily collection summary (Req 3.1)
// ---------------------------------------------------------------------------
router.get(
  '/summary',
  authorize('agent_collections_dashboard'),
  validate({ query: collectionSummaryQuerySchema }),
  controller.getSummary,
);

// ---------------------------------------------------------------------------
// GET /agent-collections/dashboard — Agent's own dashboard (Req 6.1)
// ---------------------------------------------------------------------------
router.get(
  '/dashboard',
  authorize('agent_collections_dashboard'),
  validate({ query: agentDashboardQuerySchema }),
  controller.getDashboard,
);

export default router;
