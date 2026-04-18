import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock functions (declared at top level so vi.mock factory can reference them)
// ---------------------------------------------------------------------------
const mockRouteFindMany = vi.fn();
const mockRouteFindUnique = vi.fn();
const mockRouteCount = vi.fn();
const mockRouteCreate = vi.fn();
const mockRouteUpdate = vi.fn();

const mockRouteCustomerFindMany = vi.fn();
const mockRouteCustomerFindFirst = vi.fn();
const mockRouteCustomerDeleteMany = vi.fn();
const mockRouteCustomerCreateMany = vi.fn();

const mockRouteAgentDeleteMany = vi.fn();
const mockRouteAgentCreateMany = vi.fn();

const mockCustomerFindMany = vi.fn();
const mockCustomerUpdate = vi.fn();
const mockCustomerUpdateMany = vi.fn();

const mockUserFindMany = vi.fn();

const mockDeliveryOrderUpdateMany = vi.fn();
const mockDeliveryOrderGroupBy = vi.fn();
const mockDeliveryOrderFindMany = vi.fn();

const mockProductVariantFindMany = vi.fn();

const mockTransaction = vi.fn();

// OSRM mock
const mockOsrmGenerateRoutePath = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    route: {
      findMany: (...args: any[]) => mockRouteFindMany(...args),
      findUnique: (...args: any[]) => mockRouteFindUnique(...args),
      count: (...args: any[]) => mockRouteCount(...args),
      create: (...args: any[]) => mockRouteCreate(...args),
      update: (...args: any[]) => mockRouteUpdate(...args),
    },
    routeCustomer: {
      findMany: (...args: any[]) => mockRouteCustomerFindMany(...args),
      findFirst: (...args: any[]) => mockRouteCustomerFindFirst(...args),
      deleteMany: (...args: any[]) => mockRouteCustomerDeleteMany(...args),
      createMany: (...args: any[]) => mockRouteCustomerCreateMany(...args),
    },
    routeAgent: {
      deleteMany: (...args: any[]) => mockRouteAgentDeleteMany(...args),
      createMany: (...args: any[]) => mockRouteAgentCreateMany(...args),
    },
    customer: {
      findMany: (...args: any[]) => mockCustomerFindMany(...args),
      update: (...args: any[]) => mockCustomerUpdate(...args),
      updateMany: (...args: any[]) => mockCustomerUpdateMany(...args),
    },
    user: {
      findMany: (...args: any[]) => mockUserFindMany(...args),
    },
    deliveryOrder: {
      findMany: (...args: any[]) => mockDeliveryOrderFindMany(...args),
      updateMany: (...args: any[]) => mockDeliveryOrderUpdateMany(...args),
      groupBy: (...args: any[]) => mockDeliveryOrderGroupBy(...args),
    },
    productVariant: {
      findMany: (...args: any[]) => mockProductVariantFindMany(...args),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
  redis: {},
}));

vi.mock('../../lib/osrm.js', () => ({
  generateRoutePath: (...args: any[]) => mockOsrmGenerateRoutePath(...args),
  OsrmNetworkError: class OsrmNetworkError extends Error {
    constructor(msg = 'Route generation service is unavailable.') { super(msg); this.name = 'OsrmNetworkError'; }
  },
  OsrmNoRouteError: class OsrmNoRouteError extends Error {
    constructor(msg = 'No road-following route could be found.') { super(msg); this.name = 'OsrmNoRouteError'; }
  },
  OsrmUnexpectedError: class OsrmUnexpectedError extends Error {
    constructor(msg = 'Unexpected response from routing service.') { super(msg); this.name = 'OsrmUnexpectedError'; }
  },
}));

import * as routesService from './routes.service.js';
import { OsrmNetworkError, OsrmNoRouteError } from '../../lib/osrm.js';

beforeEach(() => {
  vi.clearAllMocks();
  // Default $transaction implementation: execute the callback with the mock prisma
  mockTransaction.mockImplementation(async (fn: any) => {
    // Import the mocked prisma to pass to the transaction callback
    const { prisma } = await import('../../index.js');
    return fn(prisma);
  });
});


// ---------------------------------------------------------------------------
// listRoutes
// ---------------------------------------------------------------------------
describe('listRoutes', () => {
  it('returns paginated routes', async () => {
    const routes = [{ id: 'r1', name: 'Route A', isActive: true }];
    mockRouteFindMany.mockResolvedValue(routes);
    mockRouteCount.mockResolvedValue(1);

    const result = await routesService.listRoutes(
      {},
      { page: 1, limit: 20, skip: 0, take: 20 },
    );

    expect(result.routes).toEqual(routes);
    expect(result.total).toBe(1);
  });

  it('filters by isActive', async () => {
    mockRouteFindMany.mockResolvedValue([]);
    mockRouteCount.mockResolvedValue(0);

    await routesService.listRoutes(
      { isActive: 'true' },
      { page: 1, limit: 20, skip: 0, take: 20 },
    );

    expect(mockRouteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('searches by name or description', async () => {
    mockRouteFindMany.mockResolvedValue([]);
    mockRouteCount.mockResolvedValue(0);

    await routesService.listRoutes(
      { search: 'north' },
      { page: 1, limit: 20, skip: 0, take: 20 },
    );

    const call = mockRouteFindMany.mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR).toHaveLength(2);
  });

  it('filters by routeType when provided', async () => {
    mockRouteFindMany.mockResolvedValue([]);
    mockRouteCount.mockResolvedValue(0);

    await routesService.listRoutes(
      { routeType: 'collection' },
      { page: 1, limit: 20, skip: 0, take: 20 },
    );

    expect(mockRouteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ routeType: 'collection' }),
      }),
    );
  });

  it('does not filter by routeType when omitted', async () => {
    mockRouteFindMany.mockResolvedValue([]);
    mockRouteCount.mockResolvedValue(0);

    await routesService.listRoutes(
      {},
      { page: 1, limit: 20, skip: 0, take: 20 },
    );

    const call = mockRouteFindMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty('routeType');
  });
});

// ---------------------------------------------------------------------------
// getRoute
// ---------------------------------------------------------------------------
describe('getRoute', () => {
  it('returns route when found', async () => {
    const route = { id: 'r1', name: 'Route A' };
    mockRouteFindUnique.mockResolvedValue(route);

    const result = await routesService.getRoute('r1');
    expect(result).toEqual(route);
  });

  it('throws NotFoundError when route does not exist', async () => {
    mockRouteFindUnique.mockResolvedValue(null);

    await expect(routesService.getRoute('missing')).rejects.toThrow('Route not found');
  });
});

// ---------------------------------------------------------------------------
// createRoute
// ---------------------------------------------------------------------------
describe('createRoute', () => {
  it('creates a route with name and description', async () => {
    const input = { name: 'Route North', description: 'Northern area' };
    const created = { id: 'r1', ...input, isActive: true };
    mockRouteCreate.mockResolvedValue(created);

    const result = await routesService.createRoute(input);
    expect(result.name).toBe('Route North');
    expect(mockRouteCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: input }),
    );
  });
});

// ---------------------------------------------------------------------------
// updateRoute
// ---------------------------------------------------------------------------
describe('updateRoute', () => {
  it('updates route fields', async () => {
    mockRouteFindUnique.mockResolvedValue({ id: 'r1', name: 'Old' });
    mockRouteUpdate.mockResolvedValue({ id: 'r1', name: 'New' });

    const result = await routesService.updateRoute('r1', { name: 'New' });
    expect(result.name).toBe('New');
  });

  it('throws NotFoundError for missing route', async () => {
    mockRouteFindUnique.mockResolvedValue(null);

    await expect(routesService.updateRoute('missing', { name: 'X' })).rejects.toThrow(
      'Route not found',
    );
  });
});

// ---------------------------------------------------------------------------
// deactivateRoute
// ---------------------------------------------------------------------------
describe('deactivateRoute', () => {
  it('deactivates a route with no assigned customers', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: 'r1',
      isActive: true,
      routeCustomers: [],
    });
    mockRouteUpdate.mockResolvedValue({ id: 'r1', isActive: false });

    const result = await routesService.deactivateRoute('r1');
    expect(result.isActive).toBe(false);
  });

  it('throws when customers are still assigned', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: 'r1',
      isActive: true,
      routeCustomers: [{ id: 'rc1', customerId: 'c1' }],
    });

    await expect(routesService.deactivateRoute('r1')).rejects.toThrow(
      'Cannot deactivate route with assigned customers',
    );
  });

  it('throws when route is already inactive', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: 'r1',
      isActive: false,
      routeCustomers: [],
    });

    await expect(routesService.deactivateRoute('r1')).rejects.toThrow(
      'Route is already inactive',
    );
  });
});

// ---------------------------------------------------------------------------
// assignCustomers
// ---------------------------------------------------------------------------
describe('assignCustomers', () => {
  it('assigns customers with sequence order and updates future delivery orders', async () => {
    // First call: initial route check; second call: inside transaction final fetch
    mockRouteFindUnique
      .mockResolvedValueOnce({ id: 'r1', name: 'Route A' })
      .mockResolvedValueOnce({ id: 'r1', name: 'Route A', routeCustomers: [], routeAgents: [] });

    mockCustomerFindMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    mockRouteCustomerFindMany.mockResolvedValue([]); // no previous assignments
    mockRouteCustomerDeleteMany.mockResolvedValue({ count: 0 });
    mockRouteCustomerCreateMany.mockResolvedValue({ count: 2 });
    mockCustomerUpdateMany.mockResolvedValue({ count: 2 });
    mockDeliveryOrderUpdateMany.mockResolvedValue({ count: 0 });

    const result = await routesService.assignCustomers('r1', {
      customers: [
        { customerId: 'c1', sequenceOrder: 1 },
        { customerId: 'c2', sequenceOrder: 2 },
      ],
    });

    expect(mockRouteCustomerCreateMany).toHaveBeenCalled();
    expect(mockCustomerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['c1', 'c2'] } },
        data: { routeId: 'r1' },
      }),
    );
  });

  it('rejects duplicate customer IDs', async () => {
    mockRouteFindUnique.mockResolvedValue({ id: 'r1' });

    await expect(
      routesService.assignCustomers('r1', {
        customers: [
          { customerId: 'c1', sequenceOrder: 1 },
          { customerId: 'c1', sequenceOrder: 2 },
        ],
      }),
    ).rejects.toThrow('Duplicate customer IDs');
  });

  it('rejects duplicate sequence orders', async () => {
    mockRouteFindUnique.mockResolvedValue({ id: 'r1' });

    await expect(
      routesService.assignCustomers('r1', {
        customers: [
          { customerId: 'c1', sequenceOrder: 1 },
          { customerId: 'c2', sequenceOrder: 1 },
        ],
      }),
    ).rejects.toThrow('Duplicate sequence orders');
  });

  it('throws when customer does not exist', async () => {
    mockRouteFindUnique.mockResolvedValue({ id: 'r1' });
    mockCustomerFindMany.mockResolvedValue([]); // no customers found

    await expect(
      routesService.assignCustomers('r1', {
        customers: [{ customerId: 'c-missing', sequenceOrder: 1 }],
      }),
    ).rejects.toThrow('Customer(s) not found');
  });
});

// ---------------------------------------------------------------------------
// assignAgents
// ---------------------------------------------------------------------------
describe('assignAgents', () => {
  it('assigns delivery agents to a route', async () => {
    mockRouteFindUnique
      .mockResolvedValueOnce({ id: 'r1' })
      .mockResolvedValueOnce({ id: 'r1', routeCustomers: [], routeAgents: [] });

    mockUserFindMany.mockResolvedValue([{ id: 'u1', role: 'delivery_agent' }]);
    mockRouteAgentDeleteMany.mockResolvedValue({ count: 0 });
    mockRouteAgentCreateMany.mockResolvedValue({ count: 1 });

    await routesService.assignAgents('r1', { agentIds: ['u1'] });
    expect(mockRouteAgentCreateMany).toHaveBeenCalled();
  });

  it('rejects non-delivery-agent users', async () => {
    mockRouteFindUnique.mockResolvedValue({ id: 'r1' });
    mockUserFindMany.mockResolvedValue([{ id: 'u1', role: 'admin' }]);

    await expect(
      routesService.assignAgents('r1', { agentIds: ['u1'] }),
    ).rejects.toThrow('Only delivery agents can be assigned to routes');
  });

  it('throws when agent not found', async () => {
    mockRouteFindUnique.mockResolvedValue({ id: 'r1' });
    mockUserFindMany.mockResolvedValue([]); // no agents found

    await expect(
      routesService.assignAgents('r1', { agentIds: ['u-missing'] }),
    ).rejects.toThrow('Agent not found or inactive');
  });
});

// ---------------------------------------------------------------------------
// getRouteSummary
// ---------------------------------------------------------------------------
describe('getRouteSummary', () => {
  it('returns summary with customer count, agent count, and daily quantities', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: 'r1',
      name: 'Route A',
      isActive: true,
      routeCustomers: [{ id: 'rc1' }, { id: 'rc2' }],
      routeAgents: [{ id: 'ra1' }],
    });
    mockDeliveryOrderGroupBy.mockResolvedValue([
      { productVariantId: 'pv1', _sum: { quantity: 10 }, _count: 5 },
    ]);
    mockProductVariantFindMany.mockResolvedValue([
      {
        id: 'pv1',
        unitType: 'liters',
        quantityPerUnit: 1,
        product: { name: 'Cow Milk' },
      },
    ]);

    const result = await routesService.getRouteSummary('r1');

    expect(result.customerCount).toBe(2);
    expect(result.agentCount).toBe(1);
    expect(result.dailyDeliveryByVariant).toHaveLength(1);
    expect(result.dailyDeliveryByVariant[0].productName).toBe('Cow Milk');
  });

  it('throws NotFoundError for missing route', async () => {
    mockRouteFindUnique.mockResolvedValue(null);

    await expect(routesService.getRouteSummary('missing')).rejects.toThrow('Route not found');
  });
});


// ---------------------------------------------------------------------------
// getRouteManifest
// ---------------------------------------------------------------------------
describe('getRouteManifest', () => {
  it('returns manifest with stops in sequence order and grouped products', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: 'r1',
      name: 'Route North',
      description: 'Northern area',
      isActive: true,
    });

    mockRouteCustomerFindMany.mockResolvedValue([
      {
        routeId: 'r1',
        customerId: 'c1',
        sequenceOrder: 1,
        customer: {
          id: 'c1',
          name: 'Alice',
          phone: '1111111111',
          deliveryNotes: 'Ring bell',
          addresses: [
            {
              addressLine1: '10 Main St',
              addressLine2: null,
              city: 'Springfield',
              state: 'IL',
              pincode: '62701',
            },
          ],
        },
      },
      {
        routeId: 'r1',
        customerId: 'c2',
        sequenceOrder: 2,
        customer: {
          id: 'c2',
          name: 'Bob',
          phone: '2222222222',
          deliveryNotes: null,
          addresses: [],
        },
      },
    ]);

    mockDeliveryOrderFindMany.mockResolvedValue([
      {
        id: 'do1',
        customerId: 'c1',
        productVariantId: 'pv1',
        quantity: 2,
        status: 'pending',
        productVariant: {
          unitType: 'liters',
          quantityPerUnit: 1,
          product: { name: 'Cow Milk' },
        },
      },
      {
        id: 'do2',
        customerId: 'c2',
        productVariantId: 'pv1',
        quantity: 1,
        status: 'pending',
        productVariant: {
          unitType: 'liters',
          quantityPerUnit: 1,
          product: { name: 'Cow Milk' },
        },
      },
    ]);

    const result = await routesService.getRouteManifest('r1', '2025-01-15');

    expect(result.routeId).toBe('r1');
    expect(result.routeName).toBe('Route North');
    expect(result.date).toBe('2025-01-15');
    expect(result.totalStops).toBe(2);
    expect(result.totalOrders).toBe(2);

    // First stop
    expect(result.stops[0].sequenceOrder).toBe(1);
    expect(result.stops[0].customer.name).toBe('Alice');
    expect(result.stops[0].customer.deliveryNotes).toBe('Ring bell');
    expect(result.stops[0].customer.address?.addressLine1).toBe('10 Main St');
    expect(result.stops[0].products).toHaveLength(1);
    expect(result.stops[0].products[0].productName).toBe('Cow Milk');
    expect(result.stops[0].products[0].quantity).toBe(2);

    // Second stop — no address
    expect(result.stops[1].sequenceOrder).toBe(2);
    expect(result.stops[1].customer.name).toBe('Bob');
    expect(result.stops[1].customer.address).toBeNull();
    expect(result.stops[1].products).toHaveLength(1);
  });

  it('throws NotFoundError for missing route', async () => {
    mockRouteFindUnique.mockResolvedValue(null);

    await expect(routesService.getRouteManifest('missing', '2025-01-15')).rejects.toThrow(
      'Route not found',
    );
  });

  it('returns empty products for stops with no delivery orders', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: 'r1',
      name: 'Route A',
      description: null,
      isActive: true,
    });

    mockRouteCustomerFindMany.mockResolvedValue([
      {
        routeId: 'r1',
        customerId: 'c1',
        sequenceOrder: 1,
        customer: {
          id: 'c1',
          name: 'Alice',
          phone: '1111111111',
          deliveryNotes: null,
          addresses: [],
        },
      },
    ]);

    mockDeliveryOrderFindMany.mockResolvedValue([]);

    const result = await routesService.getRouteManifest('r1', '2025-01-15');

    expect(result.totalOrders).toBe(0);
    expect(result.stops[0].products).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getRouteManifestPrintHtml
// ---------------------------------------------------------------------------
describe('getRouteManifestPrintHtml', () => {
  it('returns valid HTML with route name, date, and stop details', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: 'r1',
      name: 'Route North',
      description: null,
      isActive: true,
    });

    mockRouteCustomerFindMany.mockResolvedValue([
      {
        routeId: 'r1',
        customerId: 'c1',
        sequenceOrder: 1,
        customer: {
          id: 'c1',
          name: 'Alice',
          phone: '1111111111',
          deliveryNotes: 'Leave at door',
          addresses: [
            {
              addressLine1: '10 Main St',
              addressLine2: 'Apt 3',
              city: 'Springfield',
              state: 'IL',
              pincode: '62701',
            },
          ],
        },
      },
    ]);

    mockDeliveryOrderFindMany.mockResolvedValue([
      {
        id: 'do1',
        customerId: 'c1',
        productVariantId: 'pv1',
        quantity: 2,
        status: 'pending',
        productVariant: {
          unitType: 'liters',
          quantityPerUnit: 1,
          product: { name: 'Cow Milk' },
        },
      },
    ]);

    const html = await routesService.getRouteManifestPrintHtml('r1', '2025-01-15');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Route Manifest: Route North');
    expect(html).toContain('2025-01-15');
    expect(html).toContain('Alice');
    expect(html).toContain('10 Main St');
    expect(html).toContain('Leave at door');
    expect(html).toContain('Cow Milk');
    expect(html).toContain('<html lang="en">');
  });

  it('escapes HTML special characters in customer data', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: 'r1',
      name: 'Route <script>',
      description: null,
      isActive: true,
    });

    mockRouteCustomerFindMany.mockResolvedValue([
      {
        routeId: 'r1',
        customerId: 'c1',
        sequenceOrder: 1,
        customer: {
          id: 'c1',
          name: '<b>Hacker</b>',
          phone: '1111111111',
          deliveryNotes: null,
          addresses: [],
        },
      },
    ]);

    mockDeliveryOrderFindMany.mockResolvedValue([]);

    const html = await routesService.getRouteManifestPrintHtml('r1', '2025-01-15');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>Hacker</b>');
    expect(html).toContain('&lt;b&gt;Hacker&lt;/b&gt;');
  });
});


// ---------------------------------------------------------------------------
// generateRoutePath
// ---------------------------------------------------------------------------
describe('generateRoutePath', () => {
  const routeId = 'route-1';
  const validInput = {
    waypoints: [
      { latitude: 12.97, longitude: 77.59, type: 'customer_stop' as const, routeCustomerId: 'rc-1' },
      { latitude: 12.98, longitude: 77.60, type: 'intermediate' as const, routeCustomerId: null },
    ],
  };

  it('calls OSRM, saves result to DB, and returns path data', async () => {
    mockRouteFindUnique.mockResolvedValue({ id: routeId, name: 'Route A' });
    mockOsrmGenerateRoutePath.mockResolvedValue({
      polyline: '_p~iF~ps|U_ulLnnqC',
      distanceMeters: 1500,
      durationSeconds: 120,
    });
    const generatedAt = new Date('2025-06-01T10:00:00Z');
    mockRouteUpdate.mockResolvedValue({
      id: routeId,
      routePathGeneratedAt: generatedAt,
      routeCustomers: [],
      routeAgents: [],
    });

    const result = await routesService.generateRoutePath(routeId, validInput);

    expect(mockOsrmGenerateRoutePath).toHaveBeenCalledWith([
      { latitude: 12.97, longitude: 77.59 },
      { latitude: 12.98, longitude: 77.60 },
    ]);
    expect(mockRouteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: routeId },
        data: expect.objectContaining({
          routePath: '_p~iF~ps|U_ulLnnqC',
          routeDistanceMeters: 1500,
          routeDurationSeconds: 120,
        }),
      }),
    );
    expect(result.polyline).toBe('_p~iF~ps|U_ulLnnqC');
    expect(result.distanceMeters).toBe(1500);
    expect(result.durationSeconds).toBe(120);
    expect(result.generatedAt).toEqual(generatedAt);
  });

  it('propagates OsrmNetworkError when OSRM is unreachable', async () => {
    mockRouteFindUnique.mockResolvedValue({ id: routeId, name: 'Route A' });
    mockOsrmGenerateRoutePath.mockRejectedValue(
      new OsrmNetworkError('Route generation service is unavailable.'),
    );

    await expect(routesService.generateRoutePath(routeId, validInput)).rejects.toThrow(
      'Route generation service is unavailable.',
    );
    expect(mockRouteUpdate).not.toHaveBeenCalled();
  });

  it('propagates OsrmNoRouteError when no route is found', async () => {
    mockRouteFindUnique.mockResolvedValue({ id: routeId, name: 'Route A' });
    mockOsrmGenerateRoutePath.mockRejectedValue(
      new OsrmNoRouteError('No road-following route could be found.'),
    );

    await expect(routesService.generateRoutePath(routeId, validInput)).rejects.toThrow(
      'No road-following route could be found.',
    );
    expect(mockRouteUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for non-existent route', async () => {
    mockRouteFindUnique.mockResolvedValue(null);

    await expect(routesService.generateRoutePath('missing', validInput)).rejects.toThrow(
      'Route not found',
    );
    expect(mockOsrmGenerateRoutePath).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getRoutePath
// ---------------------------------------------------------------------------
describe('getRoutePath', () => {
  const routeId = 'route-1';

  it('returns path with isStale false when customer stops match', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: routeId,
      routePath: '_p~iF~ps|U_ulLnnqC',
      routeWaypoints: [
        { latitude: 12.97, longitude: 77.59, type: 'customer_stop', routeCustomerId: 'rc-1' },
        { latitude: 12.98, longitude: 77.60, type: 'intermediate', routeCustomerId: null },
      ],
      routeDistanceMeters: 1500,
      routeDurationSeconds: 120,
      routePathGeneratedAt: new Date('2025-06-01T10:00:00Z'),
      routeCustomers: [
        { id: 'rc-1', dropLatitude: 12.97, dropLongitude: 77.59, sequenceOrder: 1 },
      ],
    });

    const result = await routesService.getRoutePath(routeId);

    expect(result).not.toBeNull();
    expect(result!.polyline).toBe('_p~iF~ps|U_ulLnnqC');
    expect(result!.distanceMeters).toBe(1500);
    expect(result!.durationSeconds).toBe(120);
    expect(result!.isStale).toBe(false);
  });

  it('returns path with isStale true when customer stops have changed', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: routeId,
      routePath: '_p~iF~ps|U_ulLnnqC',
      routeWaypoints: [
        { latitude: 12.97, longitude: 77.59, type: 'customer_stop', routeCustomerId: 'rc-1' },
      ],
      routeDistanceMeters: 1500,
      routeDurationSeconds: 120,
      routePathGeneratedAt: new Date('2025-06-01T10:00:00Z'),
      routeCustomers: [
        { id: 'rc-1', dropLatitude: 12.97, dropLongitude: 77.59, sequenceOrder: 1 },
        { id: 'rc-2', dropLatitude: 13.00, dropLongitude: 77.62, sequenceOrder: 2 },
      ],
    });

    const result = await routesService.getRoutePath(routeId);

    expect(result).not.toBeNull();
    expect(result!.isStale).toBe(true);
  });

  it('returns null when no path has been generated', async () => {
    mockRouteFindUnique.mockResolvedValue({
      id: routeId,
      routePath: null,
      routeWaypoints: null,
      routeDistanceMeters: null,
      routeDurationSeconds: null,
      routePathGeneratedAt: null,
      routeCustomers: [],
    });

    const result = await routesService.getRoutePath(routeId);
    expect(result).toBeNull();
  });

  it('throws NotFoundError for non-existent route', async () => {
    mockRouteFindUnique.mockResolvedValue(null);

    await expect(routesService.getRoutePath('missing')).rejects.toThrow('Route not found');
  });
});

// ---------------------------------------------------------------------------
// generatePathSchema validation (fewer than 2 waypoints)
// ---------------------------------------------------------------------------
describe('generatePathSchema validation', () => {
  it('rejects fewer than 2 waypoints', async () => {
    const { generatePathSchema } = await import('./routes.types.js');
    const result = generatePathSchema.safeParse({
      waypoints: [
        { latitude: 12.97, longitude: 77.59, type: 'customer_stop', routeCustomerId: null },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('At least 2 waypoints are required');
    }
  });

  it('accepts exactly 2 waypoints', async () => {
    const { generatePathSchema } = await import('./routes.types.js');
    const result = generatePathSchema.safeParse({
      waypoints: [
        { latitude: 12.97, longitude: 77.59, type: 'customer_stop', routeCustomerId: null },
        { latitude: 12.98, longitude: 77.60, type: 'intermediate', routeCustomerId: null },
      ],
    });
    expect(result.success).toBe(true);
  });
});
