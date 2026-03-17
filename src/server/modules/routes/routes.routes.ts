import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  createRouteSchema,
  updateRouteSchema,
  routeQuerySchema,
  assignCustomersSchema,
  assignAgentsSchema,
  manifestQuerySchema,
} from './routes.types.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import * as controller from './routes.controller.js';

const router = Router();

const adminPlus = ['super_admin', 'admin', 'billing_staff', 'read_only'];
const adminOnly = ['super_admin', 'admin'];

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /routes — list (paginated, filterable)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authorize(adminPlus),
  validate({ query: routeQuerySchema }),
  controller.list,
);

// ---------------------------------------------------------------------------
// GET /routes/:id/summary — route summary stats (must be before /:id)
// ---------------------------------------------------------------------------
router.get('/:id/summary', authorize(adminPlus), validate({ params: uuidParamSchema }), controller.summary);

// ---------------------------------------------------------------------------
// GET /routes/:id/manifest/print — printable manifest HTML (must be before /:id/manifest)
// ---------------------------------------------------------------------------
router.get(
  '/:id/manifest/print',
  authorize(adminPlus),
  validate({ params: uuidParamSchema, query: manifestQuerySchema }),
  controller.manifestPrint,
);

// ---------------------------------------------------------------------------
// GET /routes/:id/manifest — route manifest JSON
// ---------------------------------------------------------------------------
router.get(
  '/:id/manifest',
  authorize(adminPlus),
  validate({ params: uuidParamSchema, query: manifestQuerySchema }),
  controller.manifest,
);

// ---------------------------------------------------------------------------
// GET /routes/:id — detail
// ---------------------------------------------------------------------------
router.get('/:id', authorize(adminPlus), validate({ params: uuidParamSchema }), controller.getById);

// ---------------------------------------------------------------------------
// POST /routes — create
// ---------------------------------------------------------------------------
router.post(
  '/',
  authorize(adminOnly),
  csrfProtection,
  validate({ body: createRouteSchema }),
  auditLog(),
  controller.create,
);

// ---------------------------------------------------------------------------
// PUT /routes/:id — update
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateRouteSchema }),
  auditLog(),
  controller.update,
);

// ---------------------------------------------------------------------------
// PATCH /routes/:id/deactivate — deactivate route
// ---------------------------------------------------------------------------
router.patch(
  '/:id/deactivate',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema }),
  auditLog(),
  controller.deactivate,
);

// ---------------------------------------------------------------------------
// PUT /routes/:id/customers — assign / reorder customers
// ---------------------------------------------------------------------------
router.put(
  '/:id/customers',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: assignCustomersSchema }),
  auditLog(),
  controller.assignCustomers,
);

// ---------------------------------------------------------------------------
// PUT /routes/:id/agents — assign agents
// ---------------------------------------------------------------------------
router.put(
  '/:id/agents',
  authorize(adminOnly),
  csrfProtection,
  validate({ params: uuidParamSchema, body: assignAgentsSchema }),
  auditLog(),
  controller.assignAgents,
);

export default router;
