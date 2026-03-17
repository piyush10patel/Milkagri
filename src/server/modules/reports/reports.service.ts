import { prisma } from '../../index.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type {
  DateRangeQuery,
  RouteDeliveryQuery,
  OutstandingQuery,
  RevenueQuery,
} from './reports.types.js';

// ---------------------------------------------------------------------------
// 1. Daily delivery quantity report (Req 11.1)
//    Total quantities delivered, grouped by product variant
// ---------------------------------------------------------------------------
export async function dailyDeliveryReport(query: DateRangeQuery) {
  const { startDate, endDate } = query;
  const pagination = parsePagination(query.page, query.limit);

  const where = {
    deliveryDate: {
      gte: new Date(startDate + 'T00:00:00.000Z'),
      lte: new Date(endDate + 'T00:00:00.000Z'),
    },
    status: 'delivered' as const,
  };

  const items = await prisma.deliveryOrder.groupBy({
    by: ['productVariantId', 'deliveryDate'],
    where,
    _sum: { quantity: true },
    _count: { id: true },
    orderBy: [{ deliveryDate: 'asc' }],
    skip: pagination.skip,
    take: pagination.take,
  });

  // Get total count for pagination
  const allGroups = await prisma.deliveryOrder.groupBy({
    by: ['productVariantId', 'deliveryDate'],
    where,
  });
  const total = allGroups.length;

  // Enrich with product variant info
  const variantIds = [...new Set(items.map((i) => i.productVariantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: { select: { name: true } } },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const enriched = items.map((item) => {
    const variant = variantMap.get(item.productVariantId);
    return {
      deliveryDate: item.deliveryDate,
      productVariantId: item.productVariantId,
      productName: variant?.product.name ?? '',
      unitType: variant?.unitType ?? '',
      quantityPerUnit: variant?.quantityPerUnit ?? 0,
      totalQuantity: item._sum.quantity ?? 0,
      orderCount: item._count.id,
    };
  });

  return paginatedResponse(enriched, total, pagination);
}


// ---------------------------------------------------------------------------
// 2. Route-wise delivery report (Req 11.2)
//    Delivery counts and statuses per route for a date range
// ---------------------------------------------------------------------------
export async function routeDeliveryReport(query: RouteDeliveryQuery) {
  const { startDate, endDate, routeId } = query;
  const pagination = parsePagination(query.page, query.limit);

  const dateFilter = {
    gte: new Date(startDate + 'T00:00:00.000Z'),
    lte: new Date(endDate + 'T00:00:00.000Z'),
  };

  const where: Record<string, unknown> = {
    deliveryDate: dateFilter,
    routeId: routeId ? routeId : { not: null },
  };

  const items = await prisma.deliveryOrder.groupBy({
    by: ['routeId', 'status'],
    where: where as any,
    _count: { id: true },
    _sum: { quantity: true },
  });

  // Pivot into per-route rows
  const routeMap = new Map<
    string,
    { routeId: string; delivered: number; skipped: number; failed: number; returned: number; pending: number; total: number }
  >();

  for (const item of items) {
    const rid = item.routeId ?? 'unassigned';
    if (!routeMap.has(rid)) {
      routeMap.set(rid, { routeId: rid, delivered: 0, skipped: 0, failed: 0, returned: 0, pending: 0, total: 0 });
    }
    const row = routeMap.get(rid)!;
    const count = item._count.id;
    const status = item.status as string;
    if (status === 'delivered') row.delivered = count;
    else if (status === 'skipped') row.skipped = count;
    else if (status === 'failed') row.failed = count;
    else if (status === 'returned') row.returned = count;
    else if (status === 'pending') row.pending = count;
    row.total += count;
  }

  // Enrich with route names
  const routeIds = [...routeMap.keys()].filter((id) => id !== 'unassigned');
  const routes = await prisma.route.findMany({
    where: { id: { in: routeIds } },
    select: { id: true, name: true },
  });
  const routeNameMap = new Map(routes.map((r) => [r.id, r.name]));

  const allRows = [...routeMap.values()].map((row) => ({
    ...row,
    routeName: routeNameMap.get(row.routeId) ?? 'Unassigned',
  }));

  const total = allRows.length;
  const paged = allRows.slice(pagination.skip, pagination.skip + pagination.take);

  return paginatedResponse(paged, total, pagination);
}

// ---------------------------------------------------------------------------
// 3. Customer outstanding report (Req 11.3)
//    Customers with unpaid balances, invoice details, aging
// ---------------------------------------------------------------------------
export async function customerOutstandingReport(query: OutstandingQuery) {
  const pagination = parsePagination(query.page, query.limit);

  const invoices = await prisma.invoice.findMany({
    where: {
      isCurrent: true,
      paymentStatus: { in: ['unpaid', 'partial'] },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { closingBalance: 'desc' },
  });

  // Group by customer
  const customerMap = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      phone: string;
      totalOutstanding: number;
      invoiceCount: number;
      oldestInvoiceDate: Date;
      agingDays: number;
    }
  >();

  const now = new Date();

  for (const inv of invoices) {
    const cid = inv.customerId;
    if (!customerMap.has(cid)) {
      customerMap.set(cid, {
        customerId: cid,
        customerName: inv.customer.name,
        phone: inv.customer.phone,
        totalOutstanding: 0,
        invoiceCount: 0,
        oldestInvoiceDate: inv.billingCycleEnd,
        agingDays: 0,
      });
    }
    const entry = customerMap.get(cid)!;
    entry.totalOutstanding += Number(inv.closingBalance) - Number(inv.totalPayments);
    entry.invoiceCount++;
    if (inv.billingCycleEnd < entry.oldestInvoiceDate) {
      entry.oldestInvoiceDate = inv.billingCycleEnd;
    }
  }

  // Calculate aging
  for (const entry of customerMap.values()) {
    entry.agingDays = Math.floor(
      (now.getTime() - entry.oldestInvoiceDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  let allRows = [...customerMap.values()];

  // Sort
  const sortBy = query.sortBy ?? 'totalOutstanding';
  const sortOrder = query.sortOrder ?? 'desc';
  allRows.sort((a, b) => {
    const aVal = (a as any)[sortBy] ?? 0;
    const bVal = (b as any)[sortBy] ?? 0;
    return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const total = allRows.length;
  const paged = allRows.slice(pagination.skip, pagination.skip + pagination.take);

  return paginatedResponse(paged, total, pagination);
}


// ---------------------------------------------------------------------------
// 4. Revenue report (Req 11.4)
//    Total billed revenue aggregated by day, week, or month
// ---------------------------------------------------------------------------
export async function revenueReport(query: RevenueQuery) {
  const { startDate, endDate, groupBy = 'day' } = query;
  const pagination = parsePagination(query.page, query.limit);

  const dateFilter = {
    gte: new Date(startDate + 'T00:00:00.000Z'),
    lte: new Date(endDate + 'T00:00:00.000Z'),
  };

  // Get delivered orders with their line items
  const lineItems = await prisma.invoiceLineItem.findMany({
    where: {
      deliveryDate: dateFilter,
      invoice: { isCurrent: true },
    },
    select: {
      deliveryDate: true,
      lineTotal: true,
    },
  });

  // Group by period
  const buckets = new Map<string, number>();

  for (const item of lineItems) {
    const date = item.deliveryDate;
    let key: string;

    if (groupBy === 'day') {
      key = date.toISOString().slice(0, 10);
    } else if (groupBy === 'week') {
      // ISO week: Monday-based
      const d = new Date(date);
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setUTCDate(diff));
      key = monday.toISOString().slice(0, 10);
    } else {
      // month
      key = date.toISOString().slice(0, 7);
    }

    buckets.set(key, (buckets.get(key) ?? 0) + Number(item.lineTotal));
  }

  const allRows = [...buckets.entries()]
    .map(([period, revenue]) => ({ period, revenue }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const total = allRows.length;
  const paged = allRows.slice(pagination.skip, pagination.skip + pagination.take);

  return paginatedResponse(paged, total, pagination);
}

// ---------------------------------------------------------------------------
// 5. Product sales report (Req 11.5)
//    Total quantities delivered per product variant for a date range
// ---------------------------------------------------------------------------
export async function productSalesReport(query: DateRangeQuery) {
  const { startDate, endDate } = query;
  const pagination = parsePagination(query.page, query.limit);

  const where = {
    deliveryDate: {
      gte: new Date(startDate + 'T00:00:00.000Z'),
      lte: new Date(endDate + 'T00:00:00.000Z'),
    },
    status: 'delivered' as const,
  };

  const items = await prisma.deliveryOrder.groupBy({
    by: ['productVariantId'],
    where,
    _sum: { quantity: true },
    _count: { id: true },
  });

  const total = items.length;

  // Enrich with product info
  const variantIds = items.map((i) => i.productVariantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: { select: { name: true } } },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  let allRows = items.map((item) => {
    const variant = variantMap.get(item.productVariantId);
    return {
      productVariantId: item.productVariantId,
      productName: variant?.product.name ?? '',
      unitType: variant?.unitType ?? '',
      quantityPerUnit: variant?.quantityPerUnit ?? 0,
      sku: variant?.sku ?? '',
      totalQuantity: item._sum.quantity ?? 0,
      orderCount: item._count.id,
    };
  });

  // Sort
  const sortBy = query.sortBy ?? 'totalQuantity';
  const sortOrder = query.sortOrder ?? 'desc';
  allRows.sort((a, b) => {
    const aVal = Number((a as any)[sortBy] ?? 0);
    const bVal = Number((b as any)[sortBy] ?? 0);
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const paged = allRows.slice(pagination.skip, pagination.skip + pagination.take);

  return paginatedResponse(paged, total, pagination);
}


// ---------------------------------------------------------------------------
// 6. Missed deliveries report (Req 11.6)
//    All delivery orders with status skipped or failed, with reasons
// ---------------------------------------------------------------------------
export async function missedDeliveriesReport(query: DateRangeQuery) {
  const { startDate, endDate } = query;
  const pagination = parsePagination(query.page, query.limit);

  const where = {
    deliveryDate: {
      gte: new Date(startDate + 'T00:00:00.000Z'),
      lte: new Date(endDate + 'T00:00:00.000Z'),
    },
    status: { in: ['skipped' as const, 'failed' as const] },
  };

  const [items, total] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        productVariant: {
          include: { product: { select: { name: true } } },
        },
        route: { select: { id: true, name: true } },
        deliverer: { select: { id: true, name: true } },
      },
      orderBy: { deliveryDate: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.deliveryOrder.count({ where }),
  ]);

  const rows = items.map((order) => ({
    id: order.id,
    deliveryDate: order.deliveryDate,
    status: order.status,
    skipReason: order.skipReason,
    failureReason: order.failureReason,
    quantity: order.quantity,
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      phone: order.customer.phone,
    },
    productName: order.productVariant.product.name,
    unitType: order.productVariant.unitType,
    route: order.route ? { id: order.route.id, name: order.route.name } : null,
    deliveryAgent: order.deliverer ? { id: order.deliverer.id, name: order.deliverer.name } : null,
  }));

  return paginatedResponse(rows, total, pagination);
}

// ---------------------------------------------------------------------------
// 7. Subscription change audit report (Req 11.7)
//    All subscription modifications with timestamps and user
// ---------------------------------------------------------------------------
export async function subscriptionChangesReport(query: DateRangeQuery) {
  const { startDate, endDate } = query;
  const pagination = parsePagination(query.page, query.limit);

  const where = {
    createdAt: {
      gte: new Date(startDate + 'T00:00:00.000Z'),
      lte: new Date(endDate + 'T23:59:59.999Z'),
    },
  };

  const [items, total] = await Promise.all([
    prisma.subscriptionChange.findMany({
      where,
      include: {
        subscription: {
          select: {
            id: true,
            customer: { select: { id: true, name: true } },
            productVariant: {
              include: { product: { select: { name: true } } },
            },
          },
        },
        changer: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.subscriptionChange.count({ where }),
  ]);

  const rows = items.map((change) => ({
    id: change.id,
    subscriptionId: change.subscriptionId,
    changeType: change.changeType,
    oldValue: change.oldValue,
    newValue: change.newValue,
    createdAt: change.createdAt,
    customer: {
      id: change.subscription.customer.id,
      name: change.subscription.customer.name,
    },
    productName: change.subscription.productVariant.product.name,
    changedBy: {
      id: change.changer.id,
      name: change.changer.name,
      role: change.changer.role,
    },
  }));

  return paginatedResponse(rows, total, pagination);
}
