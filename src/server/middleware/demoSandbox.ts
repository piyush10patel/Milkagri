import type { Request, Response, NextFunction } from 'express';
import { PERMISSION_NAMES } from '../modules/permissions/permissions.types.js';

const today = () => new Date().toISOString().slice(0, 10);

const routes = [
  { id: 'demo-route-1', name: 'Central Morning Route', description: 'Urban delivery corridor', isActive: true, routeType: 'delivery', _count: { customers: 2, agents: 1 }, createdAt: '2026-06-01T00:00:00.000Z' },
  { id: 'demo-route-2', name: 'Village Collection Route', description: 'Procurement route for nearby villages', isActive: true, routeType: 'collection', _count: { customers: 0, agents: 1 }, createdAt: '2026-06-01T00:00:00.000Z' },
];

const users = [
  { id: 'demo-user-admin', name: 'Demo Admin', email: 'admin.demo@example.com', role: 'admin', isActive: true, createdAt: '2026-06-01T00:00:00.000Z' },
  { id: 'demo-agent-1', name: 'Arjun Field Agent', email: 'agent.demo@example.com', role: 'delivery_agent', isActive: true, createdAt: '2026-06-01T00:00:00.000Z' },
];

const products = [
  {
    id: 'demo-product-1',
    name: 'Buffalo Milk',
    category: 'Milk',
    description: 'Fresh buffalo milk packets',
    isActive: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    variants: [
      { id: 'demo-variant-1', unitType: 'packet', quantityPerUnit: 0.5, sku: 'BUF-500', isActive: true },
      { id: 'demo-variant-2', unitType: 'packet', quantityPerUnit: 1, sku: 'BUF-1000', isActive: true },
    ],
  },
  {
    id: 'demo-product-2',
    name: 'Cow Milk',
    category: 'Milk',
    description: 'Fresh cow milk packets',
    isActive: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    variants: [
      { id: 'demo-variant-3', unitType: 'packet', quantityPerUnit: 0.5, sku: 'COW-500', isActive: true },
    ],
  },
];

const customers = [
  {
    id: 'demo-customer-1',
    name: 'Riya Shah',
    phone: '9000000001',
    email: 'riya.demo@example.com',
    status: 'active',
    route: { id: 'demo-route-1', name: 'Central Morning Route' },
    routeId: 'demo-route-1',
    pricingCategory: 'cat_1',
    billingFrequency: 'monthly',
    deliveryNotes: 'Leave at reception',
    preferredDeliveryWindow: '6:00 AM - 8:00 AM',
    createdAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'demo-customer-2',
    name: 'Neel Patel',
    phone: '9000000002',
    email: 'neel.demo@example.com',
    status: 'active',
    route: { id: 'demo-route-1', name: 'Central Morning Route' },
    routeId: 'demo-route-1',
    pricingCategory: 'cat_2',
    billingFrequency: 'monthly',
    deliveryNotes: 'Ring bell once',
    preferredDeliveryWindow: '7:00 AM - 9:00 AM',
    createdAt: '2026-06-01T00:00:00.000Z',
  },
];

const subscriptions = [
  {
    id: 'demo-subscription-1',
    customer: { id: 'demo-customer-1', name: 'Riya Shah' },
    route: { id: 'demo-route-1', name: 'Central Morning Route' },
    productVariant: { id: 'demo-variant-1', product: { name: 'Buffalo Milk' }, unitType: 'packet', quantityPerUnit: 0.5 },
    quantity: 2,
    deliverySession: 'morning',
    frequencyType: 'daily',
    status: 'active',
    startDate: '2026-06-01',
  },
  {
    id: 'demo-subscription-2',
    customer: { id: 'demo-customer-2', name: 'Neel Patel' },
    route: { id: 'demo-route-1', name: 'Central Morning Route' },
    productVariant: { id: 'demo-variant-3', product: { name: 'Cow Milk' }, unitType: 'packet', quantityPerUnit: 0.5 },
    quantity: 1,
    deliverySession: 'morning',
    frequencyType: 'daily',
    status: 'active',
    startDate: '2026-06-01',
  },
];

const villages = [
  {
    id: 'demo-village-1',
    name: 'Anandpur',
    isActive: true,
    farmers: [
      { id: 'demo-farmer-1', name: 'Kiran Dairy Farm', isActive: true },
      { id: 'demo-farmer-2', name: 'Bhavesh Patel', isActive: true },
    ],
    stops: [],
  },
  {
    id: 'demo-village-2',
    name: 'Nandgram',
    isActive: true,
    farmers: [
      { id: 'demo-farmer-3', name: 'Meera Cooperative', isActive: true },
    ],
    stops: [],
  },
];

const invoices = [
  {
    id: 'demo-invoice-1',
    customer: { id: 'demo-customer-1', name: 'Riya Shah' },
    billingCycleStart: '2026-06-01',
    billingCycleEnd: '2026-06-30',
    version: 1,
    totalCharges: 1800,
    totalDiscounts: 0,
    totalAdjustments: 0,
    totalPayments: 500,
    closingBalance: 1300,
    paymentStatus: 'partial',
    generatedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'demo-invoice-2',
    customer: { id: 'demo-customer-2', name: 'Neel Patel' },
    billingCycleStart: '2026-06-01',
    billingCycleEnd: '2026-06-30',
    version: 1,
    totalCharges: 900,
    totalDiscounts: 0,
    totalAdjustments: 0,
    totalPayments: 0,
    closingBalance: 900,
    paymentStatus: 'unpaid',
    generatedAt: '2026-06-01T00:00:00.000Z',
  },
];

function listResponse(data: unknown[], page = 1, limit = 20) {
  return {
    data,
    items: data,
    pagination: { page, limit, total: data.length, totalPages: Math.max(1, Math.ceil(data.length / limit)) },
  };
}

function itemResponse(data: unknown) {
  return { data };
}

function pathWithoutVersion(req: Request) {
  return req.path.replace(/^\/v1(?=\/)/, '');
}

function demoMilkSummary() {
  return {
    date: today(),
    totals: { planned: 3, collected: 235, pending: 1 },
    shiftTotals: { morning: 150, evening: 85 },
    villages,
    villageRows: villages.map((village, index) => ({
      villageId: village.id,
      villageName: village.name,
      isActive: true,
      morningQuantity: index === 0 ? 90 : 60,
      eveningQuantity: index === 0 ? 55 : 30,
      totalQuantity: index === 0 ? 145 : 90,
      farmerMorningQuantity: index === 0 ? 90 : 60,
      farmerEveningQuantity: index === 0 ? 55 : 30,
      farmerTotalQuantity: index === 0 ? 145 : 90,
      individualMorningQuantity: 0,
      individualEveningQuantity: 0,
      individualTotalQuantity: 0,
      morningDifference: 0,
      eveningDifference: 0,
      totalDifference: 0,
      morningRouteName: 'Village Collection Route',
      morningAgentNames: ['Arjun Field Agent'],
      eveningRouteName: 'Village Collection Route',
      eveningAgentNames: ['Arjun Field Agent'],
    })),
    villageRouteAssignments: villages.map((village) => ({
      villageId: village.id,
      villageName: village.name,
      morning: { routeName: 'Village Collection Route', agentNames: ['Arjun Field Agent'] },
      evening: { routeName: 'Village Collection Route', agentNames: ['Arjun Field Agent'] },
    })),
    farmerRows: villages.flatMap((village) =>
      village.farmers.map((farmer) => ({
        farmerId: farmer.id,
        farmerName: farmer.name,
        villageId: village.id,
        villageName: village.name,
        isActive: true,
        morningQuantity: 30,
        eveningQuantity: 20,
        totalQuantity: 50,
      })),
    ),
    entries: [],
    individualCollections: [],
    vehicleShiftLoads: [],
  };
}

function demoPayload(req: Request): unknown {
  const path = pathWithoutVersion(req);
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);

  if (path === '/permissions/me') return { data: [...PERMISSION_NAMES] };
  if (path === '/permissions') return { data: {} };
  if (path.startsWith('/users')) return listResponse(users, page, limit);
  if (path === '/customers') return listResponse(customers, page, limit);
  if (path.match(/^\/customers\/[^/]+\/ledger/)) return listResponse([{ id: 'demo-ledger-1', date: today(), description: 'Demo invoice balance', debit: 1300, credit: 0, balance: 1300 }], page, limit);
  if (path.match(/^\/customers\/[^/]+$/)) return itemResponse(customers.find((customer) => customer.id === path.split('/')[2]) ?? customers[0]);
  if (path === '/products' && req.originalUrl.startsWith('/api/products')) {
    return { items: products.flatMap((product) => product.variants.map((variant) => ({ ...variant, product: { name: product.name } }))) };
  }
  if (path === '/products') return listResponse(products, page, limit);
  if (path === '/products/pricing-matrix') return itemResponse({ categories: [{ id: 'cat_1', name: 'Standard', isActive: true }], rows: [] });
  if (path.match(/^\/products\/[^/]+\/variants\/[^/]+\/prices/)) return itemResponse([{ id: 'demo-price-1', price: 30, effectiveDate: '2026-06-01', pricingCategory: 'cat_1', branch: null }]);
  if (path.match(/^\/products\/[^/]+\/variants/)) return itemResponse(products[0].variants);
  if (path.match(/^\/products\/[^/]+$/)) return itemResponse(products.find((product) => product.id === path.split('/')[2]) ?? products[0]);
  if (path.startsWith('/pricing-categories')) return itemResponse([{ id: 'cat_1', name: 'Standard', description: 'Default demo pricing', isActive: true }]);
  if (path === '/subscriptions') return listResponse(subscriptions, page, limit);
  if (path.match(/^\/subscriptions\/[^/]+\/history/)) return itemResponse([{ id: 'demo-history-1', changeType: 'created', createdAt: '2026-06-01T00:00:00.000Z' }]);
  if (path.match(/^\/subscriptions\/[^/]+$/)) return subscriptions[0];
  if (path === '/orders') return listResponse([{ id: 'demo-order-1', customer: customers[0], deliveryDate: today(), deliverySession: 'morning', status: 'pending', quantity: 1 }], page, limit);
  if (path === '/orders/summary') return { date: today(), total: 3, pending: 1, delivered: 2, skipped: 0 };
  if (path === '/orders/milk-summary') return { totals: { planned: 3, pending: 1 }, bySession: { morning: { planned: 3, pending: 1 }, evening: { planned: 0, pending: 0 } } };
  if (path === '/delivery/routes') return listResponse(routes.filter((route) => req.query.routeType ? route.routeType === req.query.routeType : true), page, limit);
  if (path.match(/^\/delivery\/routes\/[^/]+\/path/)) return { path: null };
  if (path.match(/^\/delivery\/routes\/[^/]+$/)) return routes[0];
  if (path === '/delivery/manifest') return itemResponse([{ id: 'demo-manifest-1', customer: customers[0], routeName: 'Central Morning Route', status: 'pending', deliveryDate: today(), quantity: 1 }]);
  if (path === '/delivery/reconciliation') return { totalOrders: 3, delivered: 2, pending: 1, missed: 0 };
  if (path === '/delivery/location/live') return itemResponse({ activeVehicles: 1, generatedAt: new Date().toISOString(), vehicles: [] });
  if (path === '/billing/invoices') return listResponse(invoices, page, limit);
  if (path.match(/^\/billing\/invoices\/[^/]+$/)) return { ...invoices[0], lineItems: [] };
  if (path === '/payments/outstanding') return { ...listResponse(invoices.map((invoice) => ({ customer: customers.find((customer) => customer.id === invoice.customer.id), totalOutstanding: invoice.closingBalance, invoiceCount: 1, oldestUnpaidDate: invoice.billingCycleStart })), page, limit), summary: { totalOutstanding: 2200 } };
  if (path === '/payments/reconciliation') return { agents: [{ agent: users[1], totalCollected: 500, collectionCount: 2 }], grandTotal: 500 };
  if (path === '/payments') return listResponse([{ id: 'demo-payment-1', customer: customers[0], amount: 500, paymentDate: today(), paymentMode: 'cash' }], page, limit);
  if (path === '/reports/revenue') return itemResponse([{ period: 'Jun 2026', revenue: 2700 }]);
  if (path.startsWith('/reports')) return listResponse([], page, limit);
  if (path === '/notifications') return listResponse([], page, limit);
  if (path === '/notifications/push/public-key') return { publicKey: '' };
  if (path === '/settings') return { billingCycleStartDay: 1, cutoffTime: '22:00', notificationPreferences: {} };
  if (path === '/holidays') return listResponse([], page, limit);
  if (path === '/audit-logs') return listResponse([{ id: 'demo-audit-1', actionType: 'create', entityType: 'customer', createdAt: '2026-06-01T00:00:00.000Z', user: users[0], userId: users[0].id }], page, limit);
  if (path === '/inventory/reconciliation') return { items: products.flatMap((product) => product.variants.map((variant) => ({ productVariantId: variant.id, productName: product.name, variantSku: variant.sku, unitType: variant.unitType, quantityPerUnit: variant.quantityPerUnit, openingStock: 250, inwardStock: 120, deliveredQuantity: 75, wastageQuantity: 2, closingStock: 293, hasNegativeStock: false }))), hasNegativeStockWarning: false };
  if (path === '/inventory/inward' || path === '/inventory/wastage') return { items: [] };
  if (path === '/milk-collections') return demoMilkSummary();
  if (path === '/milk-collections/villages') return { items: villages };
  if (path === '/milk-collections/routes') return { items: [routes[1]] };
  if (path === '/milk-collections/route-stops') return { route: routes[1], stops: villages.map((village, index) => ({ id: `demo-stop-${index + 1}`, villageId: village.id, villageName: village.name, villageStopId: `demo-village-stop-${index + 1}`, villageStopName: village.name, sequenceOrder: index + 1, deliverySession: req.query.deliverySession ?? 'morning', farmers: village.farmers.map((farmer) => ({ farmer })) })) };
  if (path === '/milk-collections/route-manifest') return { route: routes[1], stops: villages };
  if (path === '/milk-collections/agent-dashboard') return { date: req.query.date ?? today(), deliveryRoutes: [routes[0]], collectionRoutes: [{ id: routes[1].id, name: routes[1].name, villages: villages.map((village) => ({ villageId: village.id, villageName: village.name, deliverySession: 'morning', farmers: village.farmers.map(({ id, name }) => ({ id, name })) })) }], recordedMilkCollections: [], recordedVillageTotals: [] };
  if (path === '/milk-collections/farmer-report') return { items: villages.flatMap((village) => village.farmers.map((farmer) => ({ farmerId: farmer.id, farmerName: farmer.name, villageId: village.id, villageName: village.name, morning: 30, evening: 20, total: 50, dayCount: 1 }))), totals: { morning: 90, evening: 60, total: 150 } };
  if (path === '/agent-collections/dashboard') return { date: req.query.date ?? today(), customers, totalCollected: 500, customersDue: customers.length };
  if (path === '/agent-collections/summary') return itemResponse([{ agent: users[1], totalCollected: 500, collectionCount: 2 }]);
  if (path === '/agent-assignments') return listResponse([{ id: 'demo-assignment-1', customerId: customers[0].id, agentId: users[1].id, assignedAt: '2026-06-01T00:00:00.000Z', customer: customers[0], agent: users[1] }], page, limit);
  if (path === '/agent-remittances') return listResponse([{ id: 'demo-remittance-1', agent: users[1], amount: 500, remittanceDate: today(), status: 'received' }], page, limit);
  if (path === '/agent-remittances/balances') return itemResponse([{ agent: users[1], balance: 500, totalCollected: 500, totalRemitted: 0 }]);

  return req.query.limit || req.query.page ? listResponse([], page, limit) : { data: [], items: [] };
}

export function demoSandbox(req: Request, res: Response, next: NextFunction): void {
  if (!(req.session as any)?.isDemo) {
    next();
    return;
  }

  const path = pathWithoutVersion(req);
  if (path.startsWith('/auth') || path === '/csrf-token' || path === '/health') {
    next();
    return;
  }

  if (req.method === 'GET') {
    res.json(demoPayload(req));
    return;
  }

  res.status(req.method === 'POST' ? 201 : 200).json({
    ok: true,
    id: 'demo-sandbox-record',
    message: 'Demo sandbox action accepted. No live data was changed.',
  });
}
