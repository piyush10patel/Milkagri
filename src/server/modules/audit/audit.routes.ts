import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../lib/validation.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { auditLogQuerySchema } from './audit.types.js';
import * as auditService from './audit.service.js';

const router = Router();

// All audit log routes require Super_Admin or Admin
router.use(authenticate, authorize(['super_admin', 'admin']));

// GET /audit-logs — search/filter audit logs (paginated)
router.get(
  '/',
  validate({ query: auditLogQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pagination = parsePagination(
        req.query.page as string,
        req.query.limit as string,
      );
      const { items, total } = await auditService.listAuditLogs(
        req.query as any,
        pagination,
      );
      res.json(paginatedResponse(items, total, pagination));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
