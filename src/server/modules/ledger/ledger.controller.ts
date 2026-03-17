import type { Request, Response, NextFunction } from 'express';
import * as ledgerService from './ledger.service.js';
import { generateLedgerPdf } from '../../lib/pdf.js';
import type { LedgerPdfData } from '../../lib/pdf.js';
import type { LedgerQuery, LedgerPdfQuery } from './ledger.types.js';

function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// GET /customers/:id/ledger
export async function getLedger(req: Request, res: Response, next: NextFunction) {
  try {
    const customerId = param(req, 'id');
    const query = req.query as unknown as LedgerQuery;
    const result = await ledgerService.getLedgerEntries(customerId, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /customers/:id/ledger/pdf
export async function getLedgerPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const customerId = param(req, 'id');
    const query = req.query as unknown as LedgerPdfQuery;
    const data = await ledgerService.getLedgerEntriesForRange(
      customerId,
      query.startDate,
      query.endDate,
    );

    const pdfDoc = generateLedgerPdf(data as unknown as LedgerPdfData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ledger-${customerId.slice(0, 8)}.pdf"`,
    );
    pdfDoc.pipe(res);
  } catch (err) {
    next(err);
  }
}
