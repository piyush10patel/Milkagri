import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  assignCustomerSchema,
  listAssignmentsQuerySchema,
} from './agent-assignments.types.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import * as controller from './agent-assignments.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /agent-assignments — Assign customer to agent (Req 1.1)
// ---------------------------------------------------------------------------
router.post(
  '/',
  authorize('agent_assignments'),
  csrfProtection,
  validate({ body: assignCustomerSchema }),
  auditLog(),
  controller.assign,
);

// ---------------------------------------------------------------------------
// GET /agent-assignments — List all assignments (Req 1.5)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authorize('agent_assignments'),
  validate({ query: listAssignmentsQuerySchema }),
  controller.list,
);

// ---------------------------------------------------------------------------
// GET /agent-assignments/agent/:agentId — Get by agent (Req 1.5)
// Admin can view any agent; delivery_agent can view own assignments
// ---------------------------------------------------------------------------
router.get(
  '/agent/:agentId',
  authorize('agent_assignments'),
  controller.getByAgent,
);

// ---------------------------------------------------------------------------
// GET /agent-assignments/customer/:customerId — Get by customer (Req 1.6)
// ---------------------------------------------------------------------------
router.get(
  '/customer/:customerId',
  authorize('agent_assignments'),
  controller.getByCustomer,
);

// ---------------------------------------------------------------------------
// DELETE /agent-assignments/:id — Remove assignment (Req 1.1)
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  authorize('agent_assignments'),
  csrfProtection,
  validate({ params: uuidParamSchema }),
  auditLog(),
  controller.remove,
);

export default router;
