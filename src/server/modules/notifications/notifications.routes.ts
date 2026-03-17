import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { notificationQuerySchema, markReadParamsSchema, notificationPreferencesSchema } from './notifications.types.js';
import * as notificationsService from './notifications.service.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /notifications — list current user's notifications (paginated)
router.get(
  '/',
  validate({ query: notificationQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any).userId as string;
      const pagination = parsePagination(
        req.query.page as string,
        req.query.limit as string,
      );
      const { items, total } = await notificationsService.listNotifications(
        userId,
        req.query as any,
        pagination,
      );
      res.json(paginatedResponse(items, total, pagination));
    } catch (err) {
      next(err);
    }
  },
);

// GET /notifications/preferences — get notification channel preferences (Admin+)
router.get(
  '/preferences',
  authorize(['super_admin', 'admin']),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const preferences = await notificationsService.getNotificationPreferences();
      res.json(preferences);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /notifications/preferences — update notification channel preferences (Admin+)
router.put(
  '/preferences',
  authorize(['super_admin', 'admin']),
  csrfProtection,
  validate({ body: notificationPreferencesSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any).userId as string;
      const preferences = await notificationsService.updateNotificationPreferences(
        req.body,
        userId,
      );
      res.json(preferences);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /notifications/:id/read — mark a notification as read
router.patch(
  '/:id/read',
  csrfProtection,
  validate({ params: markReadParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any).userId as string;
      await notificationsService.markAsRead(req.params.id as string, userId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
