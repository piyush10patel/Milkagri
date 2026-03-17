import type { Request, Response, NextFunction } from 'express';
import * as billingService from './billing.service.js';
import type { ListInvoicesQuery } from './billing.types.js';
import { generateInvoicePdf } from '../../lib/pdf.js';
import type { InvoiceData } from '../../lib/pdf.js';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// ---------------------------------------------------------------------------
// POST /billing/generate
// ---------------------------------------------------------------------------
export async function generate(req: Request, res: Response, next: NextFunction) {
  try {
    const { cycleStart, cycleEnd } = req.body;
    const result = await billingService.generateInvoicesForCycle(cycleStart, cycleEnd);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /billing/invoices
// ---------------------------------------------------------------------------
export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as ListInvoicesQuery;
    const result = await billingService.listInvoices(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /billing/invoices/:id
// ---------------------------------------------------------------------------
export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const invoice = await billingService.getInvoice(id);
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /billing/invoices/:id/pdf
// ---------------------------------------------------------------------------
export async function getInvoicePdf(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const invoice = await billingService.getInvoice(id);

    const pdfDoc = generateInvoicePdf(invoice as unknown as InvoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);
    pdfDoc.pipe(res);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /billing/invoices/:id/adjustments  (Req 9.5)
// ---------------------------------------------------------------------------
export async function addAdjustment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const userId = (req.session as any)?.userId ?? '';
    const invoice = await billingService.addAdjustment(id, req.body, userId);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /billing/invoices/:id/discounts  (Req 9.6)
// ---------------------------------------------------------------------------
export async function addDiscount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const userId = (req.session as any)?.userId ?? '';
    const invoice = await billingService.addDiscount(id, req.body, userId);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /billing/invoices/:id/regenerate
// ---------------------------------------------------------------------------
export async function regenerateInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const id = param(req, 'id');
    const invoice = await billingService.regenerateInvoice(id);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}
