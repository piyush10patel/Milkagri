import type { Request, Response, NextFunction } from 'express';
import * as agentRemittancesService from './agent-remittances.service.js';
import type { ListRemittancesQuery } from './agent-remittances.types.js';

// ---------------------------------------------------------------------------
// POST /agent-remittances — Record a remittance (Req 5.1)
// ---------------------------------------------------------------------------
export async function recordRemittance(req: Request, res: Response, next: NextFunction) {
  try {
    const adminUserId = (req.session as any)?.userId ?? '';
    const remittance = await agentRemittancesService.recordRemittance(req.body, adminUserId);
    res.locals.audit = {
      actionType: 'create',
      entityType: 'agent_remittance',
      entityId: remittance.id,
    };
    res.status(201).json(remittance);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /agent-remittances — List remittances (Req 5.6)
// ---------------------------------------------------------------------------
export async function listRemittances(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListRemittancesQuery;
    const result = await agentRemittancesService.listRemittances(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /agent-remittances/balances — Get un-remitted balances (Req 8.2)
// ---------------------------------------------------------------------------
export async function getBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const balances = await agentRemittancesService.getAgentBalances();
    res.json({ data: balances });
  } catch (err) {
    next(err);
  }
}
