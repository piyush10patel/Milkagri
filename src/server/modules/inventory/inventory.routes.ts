import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import {
  recordInwardStockSchema,
  recordWastageSchema,
  stockQuerySchema,
  stockDateParamSchema,
} from './inventory.types.js';
import * as inventoryService from './inventory.service.js';

const router = Router();

router.use(authenticate);

// POST /inventory/inward — record inward stock (Admin+)
router.post(
  '/inward',
  authorize('products'),
  csrfProtection,
  validate({ body: recordInwardStockSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any).userId;
      const entry = await inventoryService.recordInwardStock(req.body, userId);
      res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  },
);

// POST /inventory/wastage — record wastage/spoilage (Admin+)
router.post(
  '/wastage',
  authorize('products'),
  csrfProtection,
  validate({ body: recordWastageSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any).userId;
      const entry = await inventoryService.recordWastage(req.body, userId);
      res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  },
);

// GET /inventory/inward?date=YYYY-MM-DD — list inward stock for a date
router.get(
  '/inward',
  authorize('products'),
  validate({ query: stockQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await inventoryService.getInwardStockForDate(
        req.query.date as string,
        req.query.productVariantId as string | undefined,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// GET /inventory/wastage?date=YYYY-MM-DD — list wastage for a date
router.get(
  '/wastage',
  authorize('products'),
  validate({ query: stockQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await inventoryService.getWastageForDate(
        req.query.date as string,
        req.query.productVariantId as string | undefined,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// GET /inventory/reconciliation?date=YYYY-MM-DD — daily stock reconciliation report
router.get(
  '/reconciliation',
  authorize('products'),
  validate({ query: stockDateParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await inventoryService.getDailyStockReconciliation(
        req.query.date as string,
      );
      const hasWarnings = report.some((r) => r.hasNegativeStock);
      res.json({ items: report, hasNegativeStockWarning: hasWarnings });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
