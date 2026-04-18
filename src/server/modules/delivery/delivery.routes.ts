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

router.use(authenticate);

// GET /delivery/manifest?date=YYYY-MM-DD
router.get(
  '/manifest',
  authorize('deliveries'),
  validate({ query: manifestQuerySchema }),
  controller.manifest,
);

// PATCH /delivery/orders/:id/status
router.patch(
  '/orders/:id/status',
  authorize('deliveries'),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateDeliveryStatusSchema }),
  controller.updateStatus,
);

// PATCH /delivery/orders/:id/notes
router.patch(
  '/orders/:id/notes',
  authorize('deliveries'),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateDeliveryNotesSchema }),
  controller.updateNotes,
);

// GET /delivery/reconciliation?date=YYYY-MM-DD
router.get(
  '/reconciliation',
  authorize('deliveries'),
  validate({ query: reconciliationQuerySchema }),
  controller.reconciliation,
);

// GET /delivery/overview?date=YYYY-MM-DD
router.get(
  '/overview',
  authorize('deliveries'),
  validate({ query: overviewQuerySchema }),
  controller.overview,
);

// POST /delivery/location/ping
router.post(
  '/location/ping',
  authorize('deliveries'),
  csrfProtection,
  validate({ body: gpsLocationPingSchema }),
  controller.saveLocationPing,
);

// GET /delivery/location/live?minutes=120
router.get(
  '/location/live',
  authorize('deliveries'),
  validate({ query: gpsLiveQuerySchema }),
  controller.liveLocations,
);

export default router;
