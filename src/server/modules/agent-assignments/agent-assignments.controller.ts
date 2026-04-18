import type { Request, Response, NextFunction } from 'express';
import * as agentAssignmentsService from './agent-assignments.service.js';

/** Extract a single string param (Express v5 types params as string | string[]). */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// ---------------------------------------------------------------------------
// POST /agent-assignments — Assign customer to agent (Req 1.1)
// ---------------------------------------------------------------------------
export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await agentAssignmentsService.assignCustomer(req.body);
    res.locals.audit = {
      actionType: 'create',
      entityType: 'customer_agent_assignment',
      entityId: assignment.id,
    };
    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /agent-assignments/agent/:agentId — Get assignments by agent (Req 1.5)
// ---------------------------------------------------------------------------
export async function getByAgent(req: Request, res: Response, next: NextFunction) {
  try {
    const assignments = await agentAssignmentsService.getAssignmentsByAgent(
      param(req, 'agentId'),
    );
    res.json({ data: assignments });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /agent-assignments/customer/:customerId — Get assignment by customer (Req 1.6)
// ---------------------------------------------------------------------------
export async function getByCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await agentAssignmentsService.getAssignmentByCustomer(
      param(req, 'customerId'),
    );
    res.json({ data: assignment });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /agent-assignments/:id — Remove assignment (Req 1.1)
// ---------------------------------------------------------------------------
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await agentAssignmentsService.removeAssignment(param(req, 'id'));
    res.locals.audit = {
      actionType: 'delete',
      entityType: 'customer_agent_assignment',
      entityId: param(req, 'id'),
    };
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /agent-assignments — List all assignments (Req 1.5)
// ---------------------------------------------------------------------------
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await agentAssignmentsService.listAssignments(req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
