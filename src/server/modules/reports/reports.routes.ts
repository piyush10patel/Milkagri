import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../lib/validation.js';
import {
  dateRangeQuerySchema,
  routeDeliveryQuerySchema,
  outstandingQuerySchema,
  revenueQuerySchema,
  csvExportParamSchema,
} from './reports.types.js';
import * as controller from './reports.controller.js';

const router = Router();

router.use(authenticate);

// GET /reports/daily-delivery
router.get(
  '/daily-delivery',
  authorize('reports'),
  validate({ query: dateRangeQuerySchema }),
  controller.dailyDelivery,
);

// GET /reports/route-delivery
router.get(
  '/route-delivery',
  authorize('reports'),
  validate({ query: routeDeliveryQuerySchema }),
  controller.routeDelivery,
);

// GET /reports/outstanding
router.get(
  '/outstanding',
  authorize('reports'),
  validate({ query: outstandingQuerySchema }),
  controller.outstanding,
);

// GET /reports/revenue
router.get(
  '/revenue',
  authorize('reports'),
  validate({ query: revenueQuerySchema }),
  controller.revenue,
);

// GET /reports/product-sales
router.get(
  '/product-sales',
  authorize('reports'),
  validate({ query: dateRangeQuerySchema }),
  controller.productSales,
);

// GET /reports/missed-deliveries
router.get(
  '/missed-deliveries',
  authorize('reports'),
  validate({ query: dateRangeQuerySchema }),
  controller.missedDeliveries,
);

// GET /reports/subscription-changes
router.get(
  '/subscription-changes',
  authorize('reports'),
  validate({ query: dateRangeQuerySchema }),
  controller.subscriptionChanges,
);

// GET /reports/:type/csv
router.get(
  '/:type/csv',
  authorize('reports'),
  validate({ params: csvExportParamSchema }),
  controller.csvExport,
);

export default router;
