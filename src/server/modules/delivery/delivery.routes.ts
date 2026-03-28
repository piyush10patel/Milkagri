import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import {
  manifestQuerySchema,
  reconciliationQuerySchema,
  overviewQuerySchema,
  gpsLiveQuerySchema,
  gpsLocationPingSchema,
  updateDeliveryStatusSchema,
  updateDeliveryNotesSchema,
} from './delivery.types.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import * as controller from './delivery.controller.js';

const router = Router();

const deliveryAgentPlus = ['super_admin', 'admin', 'delivery_agent'];
const adminOnly = ['super_admin', 'admin'];

router.use(authenticate);

// GET /delivery/manifest?date=YYYY-MM-DD
router.get(
  '/manifest',
  authorize(deliveryAgentPlus),
  validate({ query: manifestQuerySchema }),
  controller.manifest,
);

// PATCH /delivery/orders/:id/status
router.patch(
  '/orders/:id/status',
  authorize(deliveryAgentPlus),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateDeliveryStatusSchema }),
  controller.updateStatus,
);

// PATCH /delivery/orders/:id/notes
router.patch(
  '/orders/:id/notes',
  authorize(deliveryAgentPlus),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateDeliveryNotesSchema }),
  controller.updateNotes,
);

// GET /delivery/reconciliation?date=YYYY-MM-DD
router.get(
  '/reconciliation',
  authorize(deliveryAgentPlus),
  validate({ query: reconciliationQuerySchema }),
  controller.reconciliation,
);

// GET /delivery/overview?date=YYYY-MM-DD
router.get(
  '/overview',
  authorize(adminOnly),
  validate({ query: overviewQuerySchema }),
  controller.overview,
);

// POST /delivery/location/ping
router.post(
  '/location/ping',
  authorize(deliveryAgentPlus),
  csrfProtection,
  validate({ body: gpsLocationPingSchema }),
  controller.saveLocationPing,
);

// GET /delivery/location/live?minutes=120
router.get(
  '/location/live',
  authorize(adminOnly),
  validate({ query: gpsLiveQuerySchema }),
  controller.liveLocations,
);

export default router;
