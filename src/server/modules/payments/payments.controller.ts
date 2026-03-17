import type { Request, Response, NextFunction } from 'express';
import * as paymentsService from './payments.service.js';
import type { OutstandingQuery } from './payments.types.js';

// ---------------------------------------------------------------------------
// POST /payments — Record payment (Req 10.1)
// ---------------------------------------------------------------------------
export async function recordPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.session as any)?.userId ?? '';
    const payment = await paymentsService.recordPayment(req.body, userId);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /payments/collections — Record field collection (Req 10.6)
// ---------------------------------------------------------------------------
export async function recordCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const agentUserId = (req.session as any)?.userId ?? '';
    const payment = await paymentsService.recordCollection(req.body, agentUserId);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /payments/reconciliation?date=YYYY-MM-DD (Req 10.8)
// ---------------------------------------------------------------------------
export async function getReconciliation(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.query.date as string;
    const result = await paymentsService.getCollectionReconciliation(date);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /payments/outstanding (Req 10.9)
// ---------------------------------------------------------------------------
export async function getOutstanding(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as OutstandingQuery;
    const result = await paymentsService.getOutstandingSummary(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
