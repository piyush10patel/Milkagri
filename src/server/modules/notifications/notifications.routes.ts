import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import {
  notificationQuerySchema,
  markReadParamsSchema,
  notificationPreferencesSchema,
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
} from './notifications.types.js';
import * as notificationsService from './notifications.service.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /notifications — list current user's notifications (paginated)
router.get(
  '/',
  authorize('notifications'),
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
  authorize('notifications'),
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
  authorize('notifications'),
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
  authorize('notifications'),
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

router.get(
  '/push/public-key',
  authorize('notifications'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const publicKey = notificationsService.getWebPushPublicKey();
      if (!publicKey) {
        res.status(503).json({ message: 'Web push is not configured' });
        return;
      }
      res.json({ publicKey });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/push/subscribe',
  authorize('notifications'),
  csrfProtection,
  validate({ body: pushSubscriptionSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any).userId as string;
      await notificationsService.upsertPushSubscription(
        userId,
        req.body,
        req.get('user-agent'),
      );
      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/push/subscribe',
  authorize('notifications'),
  csrfProtection,
  validate({ body: pushUnsubscribeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any).userId as string;
      await notificationsService.removePushSubscription(userId, req.body.endpoint);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
