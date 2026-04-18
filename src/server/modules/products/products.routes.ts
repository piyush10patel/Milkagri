import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../lib/validation.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  addPriceSchema,
  productQuerySchema,
  variantQuerySchema,
  priceHistoryQuerySchema,
} from './products.types.js';
import { uuidParamSchema, uuidWithSubParam } from '../../lib/paramSchemas.js';
import * as controller from './products.controller.js';

const router = Router();

router.use(authenticate);

// GET /products
router.get(
  '/',
  authorize('products'),
  validate({ query: productQuerySchema }),
  controller.list,
);

router.get(
  '/pricing-matrix',
  authorize('products'),
  controller.getPricingMatrix,
);

// GET /products/:id
router.get('/:id', authorize('products'), validate({ params: uuidParamSchema }), controller.getById);

// POST /products
router.post(
  '/',
  authorize('products'),
  csrfProtection,
  validate({ body: createProductSchema }),
  auditLog(),
  controller.create,
);

// PUT /products/:id
router.put(
  '/:id',
  authorize('products'),
  csrfProtection,
  validate({ params: uuidParamSchema, body: updateProductSchema }),
  auditLog(),
  controller.update,
);

// GET /products/:id/variants
router.get(
  '/:id/variants',
  authorize('products'),
  validate({ params: uuidParamSchema, query: variantQuerySchema }),
  controller.listVariants,
);

// POST /products/:id/variants
router.post(
  '/:id/variants',
  authorize('products'),
  csrfProtection,
  validate({ params: uuidParamSchema, body: createVariantSchema }),
  auditLog(),
  controller.createVariant,
);

// PUT /products/:id/variants/:vid
router.put(
  '/:id/variants/:vid',
  authorize('products'),
  csrfProtection,
  validate({ params: uuidWithSubParam('vid'), body: updateVariantSchema }),
  auditLog(),
  controller.updateVariant,
);

// DELETE /products/:id/variants/:vid
router.delete(
  '/:id/variants/:vid',
  authorize('products'),
  csrfProtection,
  validate({ params: uuidWithSubParam('vid') }),
  auditLog(),
  controller.deleteVariant,
);

// POST /products/:id/prices (product-level pricing)
router.post(
  '/:id/prices',
  authorize('products'),
  csrfProtection,
  validate({ params: uuidParamSchema, body: addPriceSchema }),
  auditLog(),
  controller.addPrice,
);

// GET /products/:id/prices (product-level price history)
router.get(
  '/:id/prices',
  authorize('products'),
  validate({ params: uuidParamSchema, query: priceHistoryQuerySchema }),
  controller.getPriceHistory,
);

export default router;
