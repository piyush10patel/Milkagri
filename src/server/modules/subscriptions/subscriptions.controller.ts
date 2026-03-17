import type { Request, Response, NextFunction } from 'express';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import * as subscriptionsService from './subscriptions.service.js';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

function sessionUserId(req: Request): string {
  return (req.session as any)?.userId ?? '';
}

// ---------------------------------------------------------------------------
// GET /subscriptions
// ---------------------------------------------------------------------------
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(
      req.query.page as string,
      req.query.limit as string,
    );
    const { subscriptions, total } = await subscriptionsService.listSubscriptions(
      req.query as any,
      pagination,
    );
    res.json(paginatedResponse(subscriptions, total, pagination));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /subscriptions/:id
// ---------------------------------------------------------------------------
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const subscription = await subscriptionsService.getSubscription(param(req, 'id'));
    res.json(subscription);
  } catch (err) {
    next(err);
  }
}


// ---------------------------------------------------------------------------
// POST /subscriptions
// ---------------------------------------------------------------------------
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const subscription = await subscriptionsService.createSubscription(
      req.body,
      sessionUserId(req),
    );
    res.locals.audit = {
      actionType: 'create',
      entityType: 'subscription',
      entityId: subscription.id,
    };
    res.status(201).json(subscription);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /subscriptions/:id
// ---------------------------------------------------------------------------
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const previous = await subscriptionsService.getSubscription(id);
    const subscription = await subscriptionsService.updateSubscription(
      id,
      req.body,
      sessionUserId(req),
    );

    const changes: Record<string, { old?: unknown; new?: unknown }> = {};
    for (const key of Object.keys(req.body)) {
      const oldVal = (previous as any)[key];
      const newVal = (subscription as any)[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = { old: oldVal, new: newVal };
      }
    }

    res.locals.audit = {
      actionType: 'update',
      entityType: 'subscription',
      entityId: subscription.id,
      changes,
    };
    res.json(subscription);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /subscriptions/:id/cancel
// ---------------------------------------------------------------------------
export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const subscription = await subscriptionsService.cancelSubscription(
      id,
      req.body,
      sessionUserId(req),
    );
    res.locals.audit = {
      actionType: 'update',
      entityType: 'subscription',
      entityId: subscription.id,
      changes: { status: { old: 'active', new: 'cancelled' } },
    };
    res.json(subscription);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /subscriptions/:id/vacation-holds
// ---------------------------------------------------------------------------
export async function createVacationHold(req: Request, res: Response, next: NextFunction) {
  try {
    const hold = await subscriptionsService.createVacationHold(
      param(req, 'id'),
      req.body,
      sessionUserId(req),
    );
    res.locals.audit = {
      actionType: 'create',
      entityType: 'vacation_hold',
      entityId: hold.id,
    };
    res.status(201).json(hold);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /subscriptions/:id/vacation-holds/:hid/resume
// ---------------------------------------------------------------------------
export async function resumeVacationHold(req: Request, res: Response, next: NextFunction) {
  try {
    const hold = await subscriptionsService.resumeVacationHold(
      param(req, 'id'),
      param(req, 'hid'),
      sessionUserId(req),
    );
    res.locals.audit = {
      actionType: 'update',
      entityType: 'vacation_hold',
      entityId: hold.id,
    };
    res.json(hold);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /subscriptions/:id/quantity-changes
// ---------------------------------------------------------------------------
export async function scheduleQuantityChange(req: Request, res: Response, next: NextFunction) {
  try {
    const change = await subscriptionsService.scheduleQuantityChange(
      param(req, 'id'),
      req.body,
      sessionUserId(req),
    );
    res.locals.audit = {
      actionType: 'create',
      entityType: 'quantity_change',
      entityId: change.id,
    };
    res.status(201).json(change);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /subscriptions/:id/history
// ---------------------------------------------------------------------------
export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const history = await subscriptionsService.getSubscriptionHistory(param(req, 'id'));
    res.json(history);
  } catch (err) {
    next(err);
  }
}
