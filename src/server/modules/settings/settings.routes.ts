import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { updateSettingsSchema } from './settings.types.js';
import * as settingsService from './settings.service.js';

const router = Router();

router.use(authenticate);

// GET /settings — retrieve all system settings (Super_Admin only)
router.get(
  '/',
  authorize(['super_admin']),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await settingsService.getSettings();
      res.json(settings);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /settings — update system settings (Super_Admin only)
router.put(
  '/',
  authorize(['super_admin']),
  csrfProtection,
  validate({ body: updateSettingsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any).userId;
      const settings = await settingsService.updateSettings(req.body, userId);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
