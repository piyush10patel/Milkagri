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

// All report endpoints require at least Admin-level access
const reportRoles = ['admin', 'super_admin', 'billing_staff', 'read_only'];

router.use(authenticate);

// GET /reports/daily-delivery
router.get(
  '/daily-delivery',
  authorize(reportRoles),
  validate({ query: dateRangeQuerySchema }),
  controller.dailyDelivery,
);

// GET /reports/route-delivery
router.get(
  '/route-delivery',
  authorize(reportRoles),
  validate({ query: routeDeliveryQuerySchema }),
  controller.routeDelivery,
);

// GET /reports/outstanding
router.get(
  '/outstanding',
  authorize(reportRoles),
  validate({ query: outstandingQuerySchema }),
  controller.outstanding,
);

// GET /reports/revenue
router.get(
  '/revenue',
  authorize(reportRoles),
  validate({ query: revenueQuerySchema }),
  controller.revenue,
);

// GET /reports/product-sales
router.get(
  '/product-sales',
  authorize(reportRoles),
  validate({ query: dateRangeQuerySchema }),
  controller.productSales,
);

// GET /reports/missed-deliveries
router.get(
  '/missed-deliveries',
  authorize(reportRoles),
  validate({ query: dateRangeQuerySchema }),
  controller.missedDeliveries,
);

// GET /reports/subscription-changes
router.get(
  '/subscription-changes',
  authorize(reportRoles),
  validate({ query: dateRangeQuerySchema }),
  controller.subscriptionChanges,
);

// GET /reports/:type/csv
router.get(
  '/:type/csv',
  authorize(reportRoles),
  validate({ params: csvExportParamSchema }),
  controller.csvExport,
);

export default router;
