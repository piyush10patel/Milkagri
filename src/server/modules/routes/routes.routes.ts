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
  generatePathSchema,
} from './routes.types.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import * as controller from './routes.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /routes — list (paginated, filterable)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authorize('routes'),
  validate({ query: routeQuerySchema }),
  controller.list,
);

// ---------------------------------------------------------------------------
// GET /routes/:id/summary — route summary stats (must be before /:id)
// ---------------------------------------------------------------------------
router.get('/:id/summary', authorize('routes'), validate({ params: uuidParamSchema }), controller.summary);

// ---------------------------------------------------------------------------
// GET /routes/:id/manifest/print — printable manifest HTML (must be before /:id/manifest)
// ---------------------------------------------------------------------------
router.get(
  '/:id/manifest/print',
  authorize('routes'),
  validate({ params: uuidParamSchema, query: manifestQuerySchema }),
  controller.manifestPrint,
);

// ---------------------------------------------------------------------------
// GET /routes/:id/manifest — route manifest JSON
// ---------------------------------------------------------------------------
router.get(
  '/:id/manifest',
  authorize('routes'),
  validate({ params: uuidParamSchema, query: manifestQuerySchema }),
  controller.manifest,
);

// ---------------------------------------------------------------------------
// GET /routes/:id/path — get stored route path
// ---------------------------------------------------------------------------
router.get(
  '/:id/path',
  authorize('routes'),
  validate({ params: uuidParamSchema }),
  controller.getPath,
);

// ---------------------------------------------------------------------------
// POST /routes/:id/generate-path — generate OSRM route path
// ---------------------------------------------------------------------------
router.post(
  '/:id/generate-path',
  authorize('routes'),
  csrfProtection,
  validate({ params: uuidParamSchema, body: generatePathSchema }),
  auditLog(),
  controller.generatePath,
);

// ---------------------------------------------------------------------------
// GET /routes/:id — detail
// ---------------------------------------------------------------------------
router.get('/:id', authorize('routes'), validate({ params: uuidParamSchema }), controller.getById);

// ---------------------------------------------------------------------------
// POST /routes — create
// ---------------------------------------------------------------------------
router.post(
  '/',
  authorize('routes'),
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
  authorize('routes'),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateRouteSchema }),
  auditLog(),
  controller.update,
);

// ---------------------------------------------------------------------------
// DELETE /routes/:id
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  authorize('routes'),
  csrfProtection,
  validate({ params: uuidParamSchema }),
  auditLog(),
  controller.remove,
);

// ---------------------------------------------------------------------------
// PATCH /routes/:id/deactivate — deactivate route
// ---------------------------------------------------------------------------
router.patch(
  '/:id/deactivate',
  authorize('routes'),
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
  authorize('routes'),
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
  authorize('routes'),
  csrfProtection,
  validate({ params: uuidParamSchema, body: assignAgentsSchema }),
  auditLog(),
  controller.assignAgents,
);

export default router;
