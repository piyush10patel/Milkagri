import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import {
  createHolidaySchema,
  createRouteHolidaySchema,
  holidayQuerySchema,
  holidayIdParamSchema,
} from './holidays.types.js';
import * as holidayService from './holidays.service.js';

const router = Router();

// All holiday routes require authentication; write ops require Admin+
router.use(authenticate);

// GET /holidays — list system-wide holidays (paginated, filterable by date range)
router.get(
  '/',
  authorize(['super_admin', 'admin', 'delivery_agent', 'billing_staff', 'read_only']),
  validate({ query: holidayQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pagination = parsePagination(
        req.query.page as string,
        req.query.limit as string,
      );
      const { items, total } = await holidayService.listHolidays(
        req.query as any,
        pagination,
      );
      res.json(paginatedResponse(items, total, pagination));
    } catch (err) {
      next(err);
    }
  },
);

// GET /holidays/route — list route-specific holidays
router.get(
  '/route',
  authorize(['super_admin', 'admin', 'delivery_agent', 'billing_staff', 'read_only']),
  validate({ query: holidayQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pagination = parsePagination(
        req.query.page as string,
        req.query.limit as string,
      );
      const { items, total } = await holidayService.listRouteHolidays(
        req.query as any,
        pagination,
      );
      res.json(paginatedResponse(items, total, pagination));
    } catch (err) {
      next(err);
    }
  },
);


// POST /holidays — add a system-wide holiday (Admin+)
router.post(
  '/',
  authorize(['super_admin', 'admin']),
  csrfProtection,
  validate({ body: createHolidaySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any).userId;
      const holiday = await holidayService.createHoliday(req.body, userId);
      res.status(201).json(holiday);
    } catch (err) {
      next(err);
    }
  },
);

// POST /holidays/route — add a route-specific holiday (Admin+)
router.post(
  '/route',
  authorize(['super_admin', 'admin']),
  csrfProtection,
  validate({ body: createRouteHolidaySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any).userId;
      const routeHoliday = await holidayService.createRouteHoliday(
        req.body,
        userId,
      );
      res.status(201).json(routeHoliday);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /holidays/:id — delete a future system-wide holiday (Admin+)
router.delete(
  '/:id',
  authorize(['super_admin', 'admin']),
  csrfProtection,
  validate({ params: holidayIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await holidayService.deleteHoliday(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /holidays/route/:id — delete a future route-specific holiday (Admin+)
router.delete(
  '/route/:id',
  authorize(['super_admin', 'admin']),
  csrfProtection,
  validate({ params: holidayIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await holidayService.deleteRouteHoliday(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
