import type { Request, Response, NextFunction } from 'express';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import * as routesService from './routes.service.js';

/** Extract a single string param (Express v5 types params as string | string[]). */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// ---------------------------------------------------------------------------
// GET /routes
// ---------------------------------------------------------------------------
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(
      req.query.page as string,
      req.query.limit as string,
    );
    const { routes, total } = await routesService.listRoutes(req.query as any, pagination);
    res.json(paginatedResponse(routes, total, pagination));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /routes/:id
// ---------------------------------------------------------------------------
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const route = await routesService.getRoute(param(req, 'id'));
    res.json(route);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /routes
// ---------------------------------------------------------------------------
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const route = await routesService.createRoute(req.body);
    res.locals.audit = {
      actionType: 'create',
      entityType: 'route',
      entityId: route.id,
    };
    res.status(201).json(route);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /routes/:id
// ---------------------------------------------------------------------------
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const previous = await routesService.getRoute(id);
    const route = await routesService.updateRoute(id, req.body);

    const changes: Record<string, { old?: unknown; new?: unknown }> = {};
    for (const key of Object.keys(req.body)) {
      const oldVal = (previous as any)[key];
      const newVal = (route as any)[key];
      if (oldVal !== newVal) {
        changes[key] = { old: oldVal, new: newVal };
      }
    }

    res.locals.audit = {
      actionType: 'update',
      entityType: 'route',
      entityId: route.id,
      changes,
    };
    res.json(route);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /routes/:id
// ---------------------------------------------------------------------------
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const result = await routesService.deleteRoute(id);
    res.locals.audit = {
      actionType: 'delete',
      entityType: 'route',
      entityId: id,
      changes: {
        removedAgents: { old: result.removedAgents, new: 0 },
        removedHolidays: { old: result.removedHolidays, new: 0 },
      },
    };
    res.json({ message: 'Route deleted', data: result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /routes/:id/deactivate
// ---------------------------------------------------------------------------
export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const route = await routesService.deactivateRoute(id);

    res.locals.audit = {
      actionType: 'update',
      entityType: 'route',
      entityId: route.id,
      changes: { isActive: { old: true, new: false } },
    };
    res.json(route);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /routes/:id/customers — assign / reorder customers
// ---------------------------------------------------------------------------
export async function assignCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const route = await routesService.assignCustomers(id, req.body);

    res.locals.audit = {
      actionType: 'update',
      entityType: 'route',
      entityId: id,
      changes: { customers: { new: req.body.customers } },
    };
    res.json(route);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /routes/:id/agents — assign agents
// ---------------------------------------------------------------------------
export async function assignAgents(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const route = await routesService.assignAgents(id, req.body);

    res.locals.audit = {
      actionType: 'update',
      entityType: 'route',
      entityId: id,
      changes: { agents: { new: req.body.agentIds } },
    };
    res.json(route);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /routes/:id/summary — route summary stats
// ---------------------------------------------------------------------------
export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await routesService.getRouteSummary(param(req, 'id'));
    res.json(result);
  } catch (err) {
    next(err);
  }
}


// ---------------------------------------------------------------------------
// GET /routes/:id/manifest — route manifest JSON
// ---------------------------------------------------------------------------
export async function manifest(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const date = req.query.date as string;
    const result = await routesService.getRouteManifest(id, date);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /routes/:id/manifest/print — printable manifest HTML
// ---------------------------------------------------------------------------
export async function manifestPrint(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const date = req.query.date as string;
    const html = await routesService.getRouteManifestPrintHtml(id, date);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
}
