import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { auditLog } from '../../middleware/auditLog.js';
import { validate } from '../../lib/validation.js';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import {
  createPricingCategorySchema,
  pricingCategoryQuerySchema,
  updatePricingCategorySchema,
} from './pricing-categories.types.js';
import * as controller from './pricing-categories.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['super_admin', 'admin', 'billing_staff', 'read_only']), validate({ query: pricingCategoryQuerySchema }), controller.list);

router.post(
  '/',
  authorize(['super_admin', 'admin', 'billing_staff']),
  csrfProtection,
  validate({ body: createPricingCategorySchema }),
  auditLog(),
  controller.create,
);

router.put(
  '/:id',
  authorize(['super_admin', 'admin', 'billing_staff']),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updatePricingCategorySchema }),
  auditLog(),
  controller.update,
);

router.delete(
  '/:id',
  authorize(['super_admin', 'admin']),
  csrfProtection,
  validate({ params: uuidParamSchema }),
  auditLog(),
  controller.remove,
);

export default router;
