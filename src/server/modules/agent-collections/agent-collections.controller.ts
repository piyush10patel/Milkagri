import type { Request, Response, NextFunction } from 'express';
import * as agentCollectionsService from './agent-collections.service.js';
import type { CollectionSummaryQuery, AgentDashboardQuery } from './agent-collections.types.js';

// ---------------------------------------------------------------------------
// POST /agent-collections — Record a field collection (Req 2.1)
// ---------------------------------------------------------------------------
export async function recordCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const agentUserId = (req.session as any)?.userId ?? '';
    const payment = await agentCollectionsService.recordAgentCollection(req.body, agentUserId);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /agent-collections/summary?date=YYYY-MM-DD — Daily collection summary (Req 3.1)
// ---------------------------------------------------------------------------
export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as CollectionSummaryQuery;
    const summary = await agentCollectionsService.getDailyCollectionSummary(query);
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /agent-collections/dashboard — Agent's own dashboard (Req 6.1)
// ---------------------------------------------------------------------------
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const agentId = (req.session as any)?.userId ?? '';
    const query = req.query as unknown as AgentDashboardQuery;
    const dashboard = await agentCollectionsService.getAgentDashboard(agentId, query);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
}
