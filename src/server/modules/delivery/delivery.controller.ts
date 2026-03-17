import type { Request, Response, NextFunction } from 'express';
import * as deliveryService from './delivery.service.js';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

function sessionUserId(req: Request): string {
  return (req.session as any)?.userId ?? '';
}

// ---------------------------------------------------------------------------
// GET /delivery/manifest?date=YYYY-MM-DD
// ---------------------------------------------------------------------------
export async function manifest(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.query.date as string;
    const agentId = sessionUserId(req);
    const result = await deliveryService.getAgentManifest(agentId, date);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /delivery/orders/:id/status
// ---------------------------------------------------------------------------
export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = param(req, 'id');
    const agentId = sessionUserId(req);
    const order = await deliveryService.markDeliveryStatus(orderId, req.body, agentId);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /delivery/orders/:id/notes
// ---------------------------------------------------------------------------
export async function updateNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = param(req, 'id');
    const order = await deliveryService.addDeliveryNotes(orderId, req.body.deliveryNotes);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /delivery/reconciliation?date=YYYY-MM-DD
// ---------------------------------------------------------------------------
export async function reconciliation(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.query.date as string;
    const agentId = sessionUserId(req);
    const result = await deliveryService.getReconciliation(agentId, date);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /delivery/overview?date=YYYY-MM-DD
// ---------------------------------------------------------------------------
export async function overview(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.query.date as string;
    const result = await deliveryService.getAdminOverview(date);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
