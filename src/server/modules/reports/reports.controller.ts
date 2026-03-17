import type { Request, Response, NextFunction } from 'express';
import * as reportsService from './reports.service.js';
import { generateCsv } from '../../lib/csvExport.js'; // CSV utility
import type {
  DateRangeQuery,
  RouteDeliveryQuery,
  OutstandingQuery,
  RevenueQuery,
  CsvExportParam,
} from './reports.types.js';

// ---------------------------------------------------------------------------
// GET /reports/daily-delivery
// ---------------------------------------------------------------------------
export async function dailyDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as DateRangeQuery;
    const result = await reportsService.dailyDeliveryReport(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/route-delivery
// ---------------------------------------------------------------------------
export async function routeDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as RouteDeliveryQuery;
    const result = await reportsService.routeDeliveryReport(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/outstanding
// ---------------------------------------------------------------------------
export async function outstanding(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as OutstandingQuery;
    const result = await reportsService.customerOutstandingReport(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}


// ---------------------------------------------------------------------------
// GET /reports/revenue
// ---------------------------------------------------------------------------
export async function revenue(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as RevenueQuery;
    const result = await reportsService.revenueReport(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/product-sales
// ---------------------------------------------------------------------------
export async function productSales(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as DateRangeQuery;
    const result = await reportsService.productSalesReport(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/missed-deliveries
// ---------------------------------------------------------------------------
export async function missedDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as DateRangeQuery;
    const result = await reportsService.missedDeliveriesReport(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/subscription-changes
// ---------------------------------------------------------------------------
export async function subscriptionChanges(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as DateRangeQuery;
    const result = await reportsService.subscriptionChangesReport(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/:type/csv
// ---------------------------------------------------------------------------
const reportFetchers: Record<string, (query: any) => Promise<any>> = {
  'daily-delivery': reportsService.dailyDeliveryReport,
  'route-delivery': reportsService.routeDeliveryReport,
  'outstanding': reportsService.customerOutstandingReport,
  'revenue': reportsService.revenueReport,
  'product-sales': reportsService.productSalesReport,
  'missed-deliveries': reportsService.missedDeliveriesReport,
  'subscription-changes': reportsService.subscriptionChangesReport,
};

export async function csvExport(req: Request, res: Response, next: NextFunction) {
  try {
    const { type } = req.params as unknown as CsvExportParam;
    const fetcher = reportFetchers[type];
    if (!fetcher) {
      res.status(400).json({ error: `Unknown report type: ${type}` });
      return;
    }

    // Fetch all data (override pagination to get everything)
    const query = { ...req.query, page: 1, limit: 100 } as any;
    const result = await fetcher(query);

    const csv = generateCsv(result.items);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
