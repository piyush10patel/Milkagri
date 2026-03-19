import type { Request, Response, NextFunction } from 'express';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import * as ordersService from './orders.service.js';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

function sessionUserId(req: Request): string {
  return (req.session as any)?.userId ?? '';
}

// ---------------------------------------------------------------------------
// GET /orders
// ---------------------------------------------------------------------------
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(
      req.query.page as string,
      req.query.limit as string,
    );
    const { orders, total } = await ordersService.listOrders(req.query as any, pagination);
    res.json(paginatedResponse(orders, total, pagination));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /orders/:id
// ---------------------------------------------------------------------------
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await ordersService.getOrder(param(req, 'id'));
    res.json(order);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /orders (one-time order)
// ---------------------------------------------------------------------------
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await ordersService.createOneTimeOrder(req.body, sessionUserId(req));
    res.locals.audit = {
      actionType: 'create',
      entityType: 'delivery_order',
      entityId: order.id,
    };
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /orders/:id
// ---------------------------------------------------------------------------
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const previous = await ordersService.getOrder(id);
    const order = await ordersService.updateOrder(id, req.body);

    const changes: Record<string, { old?: unknown; new?: unknown }> = {};
    for (const key of Object.keys(req.body)) {
      const oldVal = (previous as any)[key];
      const newVal = (order as any)[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = { old: oldVal, new: newVal };
      }
    }

    res.locals.audit = {
      actionType: 'update',
      entityType: 'delivery_order',
      entityId: order.id,
      changes,
    };
    res.json(order);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /orders/:id
// ---------------------------------------------------------------------------
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    await ordersService.deleteOrder(id);
    res.locals.audit = {
      actionType: 'delete',
      entityType: 'delivery_order',
      entityId: id,
    };
    res.json({ message: 'Order deleted' });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /orders/generate (manual trigger — runs synchronously)
// ---------------------------------------------------------------------------
export async function generate(req: Request, res: Response, next: NextFunction) {
  try {
    const targetDate = req.body.targetDate as string;
    const date = new Date(targetDate + 'T00:00:00.000Z');
    const summary = await ordersService.generateOrdersForDate(date);
    res.json({ message: 'Order generation complete', targetDate, ...summary });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /orders/summary
// ---------------------------------------------------------------------------
export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const date = new Date(req.query.date as string);
    const result = await ordersService.getOrderSummary(date);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /orders/milk-summary
// ---------------------------------------------------------------------------
export async function milkSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const date = new Date(req.query.date as string);
    const result = await ordersService.getMilkSummary(date);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
