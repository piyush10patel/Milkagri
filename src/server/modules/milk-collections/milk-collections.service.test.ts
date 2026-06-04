import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const mockRouteFindMany = vi.fn();
const mockMilkCollectionFindMany = vi.fn();
const mockVillageIndividualCollectionFindMany = vi.fn();
const mockFarmerFindMany = vi.fn();
const mockFarmerFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();
const mockMilkCollectionRouteStopFindMany = vi.fn();
const mockMilkCollectionUpsert = vi.fn();
const mockRouteFindUnique = vi.fn();
const mockTransaction = vi.fn();
const mockRouteAgentDeleteMany = vi.fn();
const mockRouteAgentCreateMany = vi.fn();
const mockRouteStopDeleteMany = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    route: {
      findMany: (...args: any[]) => mockRouteFindMany(...args),
      findUnique: (...args: any[]) => mockRouteFindUnique(...args),
    },
    milkCollection: {
      findMany: (...args: any[]) => mockMilkCollectionFindMany(...args),
      upsert: (...args: any[]) => mockMilkCollectionUpsert(...args),
    },
    villageIndividualCollection: {
      findMany: (...args: any[]) => mockVillageIndividualCollectionFindMany(...args),
    },
    farmer: {
      findMany: (...args: any[]) => mockFarmerFindMany(...args),
      findUnique: (...args: any[]) => mockFarmerFindUnique(...args),
    },
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
      findMany: (...args: any[]) => mockUserFindMany(...args),
    },
    milkCollectionRouteStop: {
      findMany: (...args: any[]) => mockMilkCollectionRouteStopFindMany(...args),
    },
    routeAgent: {
      deleteMany: (...args: any[]) => mockRouteAgentDeleteMany(...args),
      createMany: (...args: any[]) => mockRouteAgentCreateMany(...args),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
  redis: {},
}));

import {
  getAgentCollectionDashboard,
  saveCollectionRouteStops,
  saveMilkCollection,
} from './milk-collections.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockUserFindUnique.mockResolvedValue({ id: 'agent-1', role: 'delivery_agent' });
  mockMilkCollectionFindMany.mockResolvedValue([]);
  mockVillageIndividualCollectionFindMany.mockResolvedValue([]);
  mockTransaction.mockImplementation(async (callback: any) => {
    const tx = {
      routeAgent: {
        deleteMany: mockRouteAgentDeleteMany,
        createMany: mockRouteAgentCreateMany,
      },
      milkCollectionRouteStop: {
        deleteMany: mockRouteStopDeleteMany,
        create: vi.fn(),
      },
    };
    return callback(tx);
  });
});

describe('getAgentCollectionDashboard', () => {
  it('shows farmers for an agent assigned to a delivery route that has collection stops', async () => {
    const agentId = 'agent-1';
    const villageId = 'village-1';
    const routeId = 'route-1';

    mockRouteFindMany
      .mockResolvedValueOnce([{ id: routeId, name: 'Delivery Route A' }])
      .mockResolvedValueOnce([
        {
          id: routeId,
          name: 'Delivery Route A',
          collectionRouteStops: [
            {
              id: 'stop-1',
              villageId,
              deliverySession: 'morning',
              village: { id: villageId, name: 'Rampur' },
              villageStop: { farmers: [] },
              farmers: [],
            },
          ],
        },
      ]);
    mockFarmerFindMany.mockResolvedValue([
      { id: 'farmer-1', name: 'Asha Farmer', villageId },
      { id: 'farmer-2', name: 'Bharat Farmer', villageId },
    ]);

    const dashboard = await getAgentCollectionDashboard(agentId, '2026-06-04');

    expect(mockRouteFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          routeAgents: { some: { userId: agentId } },
          OR: [
            { routeType: 'collection' },
            { collectionRouteStops: { some: {} } },
          ],
        }),
      }),
    );
    expect(mockRouteFindMany.mock.calls[1][0].where).not.toHaveProperty('routeType');
    expect(dashboard.collectionRoutes).toHaveLength(1);
    expect(dashboard.collectionRoutes[0].villages).toEqual([
      {
        villageId,
        villageName: 'Rampur',
        deliverySession: 'morning',
        farmers: [
          { id: 'farmer-1', name: 'Asha Farmer' },
          { id: 'farmer-2', name: 'Bharat Farmer' },
        ],
      },
    ]);
  });

  it('keeps an assigned collection route visible when no stops are mapped', async () => {
    const agentId = 'agent-1';
    const routeId = 'route-1';

    mockRouteFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: routeId,
          name: 'Collection Route A',
          collectionRouteStops: [],
        },
      ]);
    mockFarmerFindMany.mockResolvedValue([]);

    const dashboard = await getAgentCollectionDashboard(agentId, '2026-06-04');

    expect(dashboard.collectionRoutes).toEqual([
      {
        id: routeId,
        name: 'Collection Route A',
        villages: [],
      },
    ]);
  });
});

describe('saveCollectionRouteStops', () => {
  it('saves selected collection agents together with village stop assignments', async () => {
    const routeId = 'route-1';
    const agentId = 'agent-1';

    mockRouteFindUnique.mockResolvedValueOnce({ id: routeId, name: 'Collection Route A', isActive: true });
    mockUserFindMany.mockResolvedValueOnce([{ id: agentId, role: 'delivery_agent' }]);
    mockRouteFindUnique.mockResolvedValueOnce({
      id: routeId,
      name: 'Collection Route A',
      isActive: true,
      routeAgents: [{ user: { id: agentId, name: 'Ravi', role: 'delivery_agent', isActive: true } }],
    });
    mockMilkCollectionRouteStopFindMany.mockResolvedValueOnce([]);
    mockFarmerFindMany.mockResolvedValueOnce([]);

    await saveCollectionRouteStops({
      routeId,
      deliverySession: 'morning',
      agentIds: [agentId],
      stops: [],
    });

    expect(mockRouteAgentDeleteMany).toHaveBeenCalledWith({ where: { routeId } });
    expect(mockRouteAgentCreateMany).toHaveBeenCalledWith({
      data: [{ routeId, userId: agentId }],
    });
  });
});

describe('saveMilkCollection', () => {
  it('allows a delivery agent to save milk for any farmer in an assigned collection-stop village', async () => {
    const agentId = 'agent-1';
    const villageId = 'village-1';
    const farmerId = 'farmer-1';

    mockUserFindUnique.mockResolvedValue({ role: 'delivery_agent' });
    mockMilkCollectionRouteStopFindMany.mockResolvedValue([
      { villageId, deliverySession: 'morning' },
    ]);
    mockFarmerFindUnique.mockResolvedValue({
      id: farmerId,
      name: 'Asha Farmer',
      villageId,
      isActive: true,
      village: { id: villageId, isActive: true },
    });
    mockMilkCollectionUpsert.mockResolvedValue({
      id: 'collection-1',
      villageId,
      farmerId,
      collectionDate: new Date('2026-06-04'),
      deliverySession: 'morning',
      quantity: new Prisma.Decimal(3.25),
      recordedBy: agentId,
    });

    await expect(
      saveMilkCollection(
        {
          villageId,
          farmerId,
          collectionDate: '2026-06-04',
          deliverySession: 'morning',
          quantity: 3.25,
        },
        agentId,
      ),
    ).resolves.toMatchObject({ id: 'collection-1', villageId, farmerId });

    expect(mockMilkCollectionRouteStopFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          route: {
            routeAgents: { some: { userId: agentId } },
          },
        },
      }),
    );
    expect(mockMilkCollectionUpsert).toHaveBeenCalled();
  });
});
