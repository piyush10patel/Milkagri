import type { NextFunction, Request, Response } from 'express';
import { uuidParamSchema } from '../../lib/paramSchemas.js';
import * as service from './pricing-categories.service.js';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.listPricingCategories(req.query as any);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await service.createPricingCategory(req.body);
    res.locals.audit = {
      actionType: 'create',
      entityType: 'pricing_category',
      entityId: category.id,
    };
    res.status(201).json({ data: category });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await service.updatePricingCategory(param(req, 'id'), req.body);
    res.locals.audit = {
      actionType: 'update',
      entityType: 'pricing_category',
      entityId: category.id,
    };
    res.json({ data: category });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.deletePricingCategory(param(req, 'id'));
    res.locals.audit = {
      actionType: 'delete',
      entityType: 'pricing_category',
      entityId: result.id,
    };
    res.json({ message: 'Pricing category deleted' });
  } catch (err) {
    next(err);
  }
}
