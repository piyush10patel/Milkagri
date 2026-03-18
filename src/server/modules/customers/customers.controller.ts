import type { Request, Response, NextFunction } from 'express';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import * as customersService from './customers.service.js';

/** Extract a single string param (Express v5 types params as string | string[]). */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// ---------------------------------------------------------------------------
// GET /customers
// ---------------------------------------------------------------------------
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = parsePagination(
      req.query.page as string,
      req.query.limit as string,
    );
    const { customers, total } = await customersService.listCustomers(
      req.query as any,
      pagination,
    );
    res.json(paginatedResponse(customers, total, pagination));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /customers/:id
// ---------------------------------------------------------------------------
export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.getCustomer(param(req, 'id'));
    res.json({ data: customer });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /customers
// ---------------------------------------------------------------------------
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.createCustomer(req.body);
    res.locals.audit = {
      actionType: 'create',
      entityType: 'customer',
      entityId: customer.id,
    };
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /customers/:id
// ---------------------------------------------------------------------------
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const previous = await customersService.getCustomer(id);
    const customer = await customersService.updateCustomer(id, req.body);

    // Build changes diff for audit
    const changes: Record<string, { old?: unknown; new?: unknown }> = {};
    for (const key of Object.keys(req.body)) {
      const oldVal = (previous as any)[key];
      const newVal = (customer as any)[key];
      if (oldVal !== newVal) {
        changes[key] = { old: oldVal, new: newVal };
      }
    }

    res.locals.audit = {
      actionType: 'update',
      entityType: 'customer',
      entityId: customer.id,
      changes,
    };
    res.json(customer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /customers/:id/status
// ---------------------------------------------------------------------------
export async function changeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const previous = await customersService.getCustomer(id);
    const userId = (req.session as any)?.userId;
    const customer = await customersService.changeCustomerStatus(id, req.body, userId);

    res.locals.audit = {
      actionType: 'update',
      entityType: 'customer',
      entityId: customer.id,
      changes: {
        status: { old: previous.status, new: customer.status },
      },
    };
    res.json(customer);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /customers/:id/addresses
// ---------------------------------------------------------------------------
export async function listAddresses(req: Request, res: Response, next: NextFunction) {
  try {
    const addresses = await customersService.listAddresses(param(req, 'id'));
    res.json(addresses);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /customers/:id/addresses
// ---------------------------------------------------------------------------
export async function createAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const address = await customersService.createAddress(param(req, 'id'), req.body);
    res.locals.audit = {
      actionType: 'create',
      entityType: 'customer_address',
      entityId: address.id,
    };
    res.status(201).json(address);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /customers/:id/addresses/:addrId
// ---------------------------------------------------------------------------
export async function updateAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const address = await customersService.updateAddress(
      param(req, 'id'),
      param(req, 'addrId'),
      req.body,
    );
    res.locals.audit = {
      actionType: 'update',
      entityType: 'customer_address',
      entityId: address.id,
    };
    res.json(address);
  } catch (err) {
    next(err);
  }
}
