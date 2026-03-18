import type { Request, Response, NextFunction } from 'express';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import * as productsService from './products.service.js';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// ---------------------------------------------------------------------------
// GET /products
// ---------------------------------------------------------------------------
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(
      req.query.page as string,
      req.query.limit as string,
    );
    const { products, total } = await productsService.listProducts(
      req.query as any,
      pagination,
    );
    res.json(paginatedResponse(products, total, pagination));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /products/:id
// ---------------------------------------------------------------------------
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productsService.getProduct(param(req, 'id'));
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /products/pricing-matrix
// ---------------------------------------------------------------------------
export async function getPricingMatrix(_req: Request, res: Response, next: NextFunction) {
  try {
    const matrix = await productsService.getPricingMatrix();
    res.json({ data: matrix });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /products
// ---------------------------------------------------------------------------
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productsService.createProduct(req.body);
    res.locals.audit = {
      actionType: 'create',
      entityType: 'product',
      entityId: product.id,
    };
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /products/:id
// ---------------------------------------------------------------------------
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const previous = await productsService.getProduct(id);
    const product = await productsService.updateProduct(id, req.body);

    const changes: Record<string, { old?: unknown; new?: unknown }> = {};
    for (const key of Object.keys(req.body)) {
      const oldVal = (previous as any)[key];
      const newVal = (product as any)[key];
      if (oldVal !== newVal) {
        changes[key] = { old: oldVal, new: newVal };
      }
    }

    res.locals.audit = {
      actionType: 'update',
      entityType: 'product',
      entityId: product.id,
      changes,
    };
    res.json(product);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /products/:id/variants
// ---------------------------------------------------------------------------
export async function listVariants(req: Request, res: Response, next: NextFunction) {
  try {
    const variants = await productsService.listVariants(
      param(req, 'id'),
      req.query as any,
    );
    res.json({ data: variants });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /products/:id/variants/:vid
// ---------------------------------------------------------------------------
export async function deleteVariant(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = param(req, 'id');
    const variantId = param(req, 'vid');
    await productsService.deleteVariant(productId, variantId);
    res.locals.audit = {
      actionType: 'delete',
      entityType: 'product_variant',
      entityId: variantId,
    };
    res.json({ message: 'Variant deleted' });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /products/:id/variants
// ---------------------------------------------------------------------------
export async function createVariant(req: Request, res: Response, next: NextFunction) {
  try {
    const variant = await productsService.createVariant(param(req, 'id'), req.body);
    res.locals.audit = {
      actionType: 'create',
      entityType: 'product_variant',
      entityId: variant.id,
    };
    res.status(201).json(variant);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /products/:id/variants/:vid
// ---------------------------------------------------------------------------
export async function updateVariant(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = param(req, 'id');
    const variantId = param(req, 'vid');
    const variant = await productsService.updateVariant(productId, variantId, req.body);

    res.locals.audit = {
      actionType: 'update',
      entityType: 'product_variant',
      entityId: variant.id,
    };
    res.json(variant);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /products/:id/variants/:vid/prices
// ---------------------------------------------------------------------------
export async function addPrice(req: Request, res: Response, next: NextFunction) {
  try {
    const price = await productsService.addPrice(
      param(req, 'id'),
      param(req, 'vid'),
      req.body,
    );
    res.locals.audit = {
      actionType: 'create',
      entityType: 'product_price',
      entityId: price.id,
    };
    res.status(201).json(price);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /products/:id/variants/:vid/prices
// ---------------------------------------------------------------------------
export async function getPriceHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(
      req.query.page as string,
      req.query.limit as string,
    );
    const { prices, total } = await productsService.getPriceHistory(
      param(req, 'id'),
      param(req, 'vid'),
      pagination,
    );
    res.json(paginatedResponse(prices, total, pagination));
  } catch (err) {
    next(err);
  }
}
