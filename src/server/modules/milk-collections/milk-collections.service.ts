import { prisma } from '../../index.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type {
  CollectionRouteManifestQuery,
  CreateFarmerInput,
  CreateVillageInput,
  SaveCollectionRouteStopsInput,
  SaveMilkCollectionInput,
  SaveMilkVehicleLoadInput,
  SaveMilkVehicleShiftLoadInput,
  SaveVillageIndividualCollectionInput,
  UpdateFarmerInput,
} from './milk-collections.types.js';

function prismaAny() {
  return prisma as any;
}

export async function listVillages() {
  return prisma.village.findMany({
    include: {
      farmers: {
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function listCollectionRoutes() {
  return prisma.route.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function getCollectionRouteStops(
  routeId: string,
  deliverySession: 'morning' | 'evening',
) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    select: { id: true, name: true, isActive: true },
  });
  if (!route) throw new NotFoundError('Route not found');

  const stops = await prismaAny().milkCollectionRouteStop.findMany({
    where: { routeId, deliverySession },
    include: {
      village: {
        select: {
          id: true,
          name: true,
          isActive: true,
          farmers: {
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          },
        },
      },
    },
    orderBy: { sequenceOrder: 'asc' },
  });

  return {
    route: { id: route.id, name: route.name, isActive: route.isActive },
    deliverySession,
    stops: stops.map((stop: any) => ({
      id: stop.id,
      villageId: stop.villageId,
      villageName: stop.village.name,
      sequenceOrder: stop.sequenceOrder,
      farmerNames: stop.village.farmers.map((farmer: any) => farmer.name),
    })),
  };
}

export async function saveCollectionRouteStops(input: SaveCollectionRouteStopsInput) {
  const route = await prisma.route.findUnique({
    where: { id: input.routeId },
    select: { id: true, name: true, isActive: true },
  });
  if (!route) throw new NotFoundError('Route not found');

  const villageIds = input.stops.map((stop) => stop.villageId);
  if (new Set(villageIds).size !== villageIds.length) {
    throw new ValidationError('Duplicate villages in collection route stops');
  }

  const sequenceOrders = input.stops.map((stop) => stop.sequenceOrder);
  if (new Set(sequenceOrders).size !== sequenceOrders.length) {
    throw new ValidationError('Duplicate sequence orders in collection route stops');
  }

  if (villageIds.length > 0) {
    const villages = await prisma.village.findMany({
      where: { id: { in: villageIds } },
      select: { id: true, isActive: true },
    });
    if (villages.length !== villageIds.length) {
      throw new NotFoundError('One or more villages were not found');
    }
    const inactive = villages.find((village) => !village.isActive);
    if (inactive) {
      throw new ValidationError('Inactive villages cannot be added to collection route');
    }
  }

  await prisma.$transaction(async (tx) => {
    await (tx as any).milkCollectionRouteStop.deleteMany({
      where: { routeId: input.routeId, deliverySession: input.deliverySession },
    });

    if (input.stops.length > 0) {
      await (tx as any).milkCollectionRouteStop.createMany({
        data: input.stops.map((stop) => ({
          routeId: input.routeId,
          villageId: stop.villageId,
          deliverySession: input.deliverySession,
          sequenceOrder: stop.sequenceOrder,
        })),
      });
    }
  });

  return getCollectionRouteStops(input.routeId, input.deliverySession);
}

export async function getCollectionRouteManifest(query: CollectionRouteManifestQuery) {
  const route = await prisma.route.findUnique({
    where: { id: query.routeId },
    select: { id: true, name: true },
  });
  if (!route) throw new NotFoundError('Route not found');

  const stops = await prismaAny().milkCollectionRouteStop.findMany({
    where: {
      routeId: query.routeId,
      deliverySession: query.deliverySession,
    },
    include: {
      village: {
        select: {
          id: true,
          name: true,
          farmers: {
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          },
        },
      },
    },
    orderBy: { sequenceOrder: 'asc' },
  });

  return {
    routeId: route.id,
    routeName: route.name,
    date: query.date,
    deliverySession: query.deliverySession,
    totalStops: stops.length,
    stops: stops.map((stop: any) => ({
      sequenceOrder: stop.sequenceOrder,
      villageId: stop.villageId,
      villageName: stop.village.name,
      farmerNames: stop.village.farmers.map((farmer: any) => farmer.name),
      farmerCount: stop.village.farmers.length,
    })),
  };
}

export async function createVillage(input: CreateVillageInput) {
  const name = input.name.trim();
  const existing = await prisma.village.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });

  if (existing) throw new ConflictError('Village already exists');

  return prisma.village.create({ data: { name } });
}

export async function createFarmer(input: CreateFarmerInput) {
  const village = await prisma.village.findUnique({ where: { id: input.villageId } });
  if (!village) throw new NotFoundError('Village not found');

  const name = input.name.trim();
  const existing = await prisma.farmer.findFirst({
    where: {
      villageId: input.villageId,
      name: { equals: name, mode: 'insensitive' },
    },
  });

  if (existing) throw new ConflictError('Farmer already exists for this village');

  return prisma.farmer.create({
    data: {
      villageId: input.villageId,
      name,
    },
  });
}

export async function updateFarmer(id: string, input: UpdateFarmerInput) {
  const existing = await prisma.farmer.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Farmer not found');

  const data: { name?: string; isActive?: boolean } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    const duplicate = await prisma.farmer.findFirst({
      where: {
        villageId: existing.villageId,
        id: { not: id },
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (duplicate) throw new ConflictError('Farmer already exists for this village');
    data.name = name;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  return prisma.farmer.update({
    where: { id },
    data,
  });
}

export async function deleteFarmer(id: string) {
  const existing = await prisma.farmer.findUnique({
    where: { id },
    include: {
      _count: { select: { milkCollections: true } },
    },
  });
  if (!existing) throw new NotFoundError('Farmer not found');

  if (existing._count.milkCollections > 0) {
    await prisma.farmer.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, mode: 'deactivated' as const };
  }

  await prisma.farmer.delete({ where: { id } });
  return { id, mode: 'deleted' as const };
}

export async function saveMilkCollection(input: SaveMilkCollectionInput, userId: string) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: input.farmerId },
    include: { village: true },
  });

  if (!farmer) throw new NotFoundError('Farmer not found');
  if (farmer.villageId !== input.villageId) throw new ValidationError('Selected farmer does not belong to the selected village');
  if (!farmer.village.isActive) throw new ValidationError('Cannot record collection for an inactive village');
  if (!farmer.isActive) throw new ValidationError('Cannot record collection for an inactive farmer');

  const collectionDate = new Date(input.collectionDate);

  return prisma.milkCollection.upsert({
    where: {
      farmerId_collectionDate_deliverySession: {
        farmerId: input.farmerId,
        collectionDate,
        deliverySession: input.deliverySession,
      },
    },
    update: {
      villageId: input.villageId,
      quantity: input.quantity,
      notes: input.notes?.trim() || null,
      recordedBy: userId,
    },
    create: {
      villageId: input.villageId,
      farmerId: input.farmerId,
      collectionDate,
      deliverySession: input.deliverySession,
      quantity: input.quantity,
      notes: input.notes?.trim() || null,
      recordedBy: userId,
    },
    include: {
      village: true,
      farmer: true,
      recorder: { select: { id: true, name: true } },
    },
  });
}

export async function saveVillageIndividualCollection(input: SaveVillageIndividualCollectionInput, userId: string) {
  const village = await prisma.village.findUnique({ where: { id: input.villageId } });
  if (!village) throw new NotFoundError('Village not found');
  if (!village.isActive) throw new ValidationError('Cannot record individual collection for an inactive village');

  const collectionDate = new Date(input.collectionDate);

  return prisma.villageIndividualCollection.upsert({
    where: {
      villageId_collectionDate_deliverySession: {
        villageId: input.villageId,
        collectionDate,
        deliverySession: input.deliverySession,
      },
    },
    update: {
      quantity: input.quantity,
      notes: input.notes?.trim() || null,
      recordedBy: userId,
    },
    create: {
      villageId: input.villageId,
      collectionDate,
      deliverySession: input.deliverySession,
      quantity: input.quantity,
      notes: input.notes?.trim() || null,
      recordedBy: userId,
    },
    include: {
      village: true,
      recorder: { select: { id: true, name: true } },
    },
  });
}

export async function saveMilkVehicleLoad(input: SaveMilkVehicleLoadInput, userId: string) {
  const village = await prisma.village.findUnique({ where: { id: input.villageId } });
  if (!village) throw new NotFoundError('Village not found');
  if (!village.isActive) throw new ValidationError('Cannot record vehicle load for an inactive village');

  const loadDate = new Date(input.loadDate);

  return prisma.milkVehicleLoad.upsert({
    where: {
      villageId_loadDate_deliverySession_milkType: {
        villageId: input.villageId,
        loadDate,
        deliverySession: input.deliverySession,
        milkType: input.milkType,
      },
    },
    update: {
      quantity: input.quantity,
      notes: input.notes?.trim() || null,
      recordedBy: userId,
    },
    create: {
      villageId: input.villageId,
      loadDate,
      deliverySession: input.deliverySession,
      milkType: input.milkType,
      quantity: input.quantity,
      notes: input.notes?.trim() || null,
      recordedBy: userId,
    },
    include: {
      village: true,
      recorder: { select: { id: true, name: true } },
    },
  });
}

export async function saveMilkVehicleShiftLoad(input: SaveMilkVehicleShiftLoadInput, userId: string) {
  const loadDate = new Date(input.loadDate);

  return prisma.milkVehicleShiftLoad.upsert({
    where: {
      loadDate_deliverySession_milkType: {
        loadDate,
        deliverySession: input.deliverySession,
        milkType: input.milkType,
      },
    },
    update: {
      quantity: input.quantity,
      notes: input.notes?.trim() || null,
      recordedBy: userId,
    },
    create: {
      loadDate,
      deliverySession: input.deliverySession,
      milkType: input.milkType,
      quantity: input.quantity,
      notes: input.notes?.trim() || null,
      recordedBy: userId,
    },
    include: {
      recorder: { select: { id: true, name: true } },
    },
  });
}

export async function deleteMilkCollection(id: string) {
  const existing = await prisma.milkCollection.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Milk collection entry not found');

  await prisma.milkCollection.delete({ where: { id } });
  return { id };
}

export async function getMilkCollectionSummary(date: string) {
  const targetDate = new Date(date);
  const [villages, entries, individualCollections, vehicleShiftLoads] = await Promise.all([
    prisma.village.findMany({
      include: {
        farmers: {
          orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.milkCollection.findMany({
      where: { collectionDate: targetDate },
      include: {
        village: true,
        farmer: true,
        recorder: { select: { id: true, name: true } },
      },
      orderBy: [
        { deliverySession: 'asc' },
        { village: { name: 'asc' } },
        { farmer: { name: 'asc' } },
      ],
    }),
    prisma.villageIndividualCollection.findMany({
      where: { collectionDate: targetDate },
      include: {
        village: true,
        recorder: { select: { id: true, name: true } },
      },
      orderBy: [
        { deliverySession: 'asc' },
        { village: { name: 'asc' } },
      ],
    }),
    prisma.milkVehicleShiftLoad.findMany({
      where: { loadDate: targetDate },
      include: {
        recorder: { select: { id: true, name: true } },
      },
      orderBy: [
        { deliverySession: 'asc' },
        { milkType: 'asc' },
      ],
    }),
  ]);

  const shiftTotals = { morning: 0, evening: 0 };

  const villageRows = villages.map((village) => ({
    villageId: village.id,
    villageName: village.name,
    isActive: village.isActive,
    farmerMorningQuantity: 0,
    farmerEveningQuantity: 0,
    farmerTotalQuantity: 0,
    individualMorningQuantity: 0,
    individualEveningQuantity: 0,
    individualTotalQuantity: 0,
    morningQuantity: 0,
    eveningQuantity: 0,
    totalQuantity: 0,
    morningDifference: 0,
    eveningDifference: 0,
    totalDifference: 0,
  }));

  const farmerRows = villages.flatMap((village) =>
    village.farmers.map((farmer) => ({
      farmerId: farmer.id,
      farmerName: farmer.name,
      villageId: village.id,
      villageName: village.name,
      isActive: farmer.isActive,
      morningQuantity: 0,
      eveningQuantity: 0,
      totalQuantity: 0,
    })),
  );

  const villageRowMap = new Map(villageRows.map((row) => [row.villageId, row]));
  const farmerRowMap = new Map(farmerRows.map((row) => [row.farmerId, row]));

  for (const entry of entries) {
    const quantity = Number(entry.quantity);

    const villageRow = villageRowMap.get(entry.villageId);
    if (villageRow) {
      if (entry.deliverySession === 'morning') villageRow.farmerMorningQuantity += quantity;
      if (entry.deliverySession === 'evening') villageRow.farmerEveningQuantity += quantity;
      villageRow.farmerTotalQuantity += quantity;
    }

    const farmerRow = farmerRowMap.get(entry.farmerId);
    if (farmerRow) {
      if (entry.deliverySession === 'morning') farmerRow.morningQuantity += quantity;
      if (entry.deliverySession === 'evening') farmerRow.eveningQuantity += quantity;
      farmerRow.totalQuantity += quantity;
    }
  }

  for (const entry of individualCollections) {
    const quantity = Number(entry.quantity);

    const villageRow = villageRowMap.get(entry.villageId);
    if (villageRow) {
      if (entry.deliverySession === 'morning') villageRow.individualMorningQuantity += quantity;
      if (entry.deliverySession === 'evening') villageRow.individualEveningQuantity += quantity;
      villageRow.individualTotalQuantity += quantity;
    }
  }

  shiftTotals.morning = 0;
  shiftTotals.evening = 0;

  for (const villageRow of villageRows) {
    // Village individual record is treated as manually recorded village total.
    // If not recorded, we fall back to farmer sum for that shift.
    const morningRecorded = villageRow.individualMorningQuantity > 0 ? villageRow.individualMorningQuantity : null;
    const eveningRecorded = villageRow.individualEveningQuantity > 0 ? villageRow.individualEveningQuantity : null;

    villageRow.morningQuantity = Number((morningRecorded ?? villageRow.farmerMorningQuantity).toFixed(3));
    villageRow.eveningQuantity = Number((eveningRecorded ?? villageRow.farmerEveningQuantity).toFixed(3));
    villageRow.totalQuantity = Number((villageRow.morningQuantity + villageRow.eveningQuantity).toFixed(3));
    villageRow.morningDifference = Number((villageRow.morningQuantity - villageRow.farmerMorningQuantity).toFixed(3));
    villageRow.eveningDifference = Number((villageRow.eveningQuantity - villageRow.farmerEveningQuantity).toFixed(3));
    villageRow.totalDifference = Number((villageRow.morningDifference + villageRow.eveningDifference).toFixed(3));

    shiftTotals.morning += villageRow.morningQuantity;
    shiftTotals.evening += villageRow.eveningQuantity;
  }

  return {
    date,
    shiftTotals: {
      morning: Number(shiftTotals.morning.toFixed(3)),
      evening: Number(shiftTotals.evening.toFixed(3)),
      total: Number((shiftTotals.morning + shiftTotals.evening).toFixed(3)),
    },
    villages,
    villageRows,
    farmerRows,
    individualCollections: individualCollections.map((entry) => ({
      id: entry.id,
      villageId: entry.villageId,
      villageName: entry.village.name,
      deliverySession: entry.deliverySession,
      quantity: Number(entry.quantity),
      notes: entry.notes,
      recordedAt: entry.updatedAt.toISOString(),
      recorder: entry.recorder,
    })),
    vehicleShiftLoads: vehicleShiftLoads.map((entry) => ({
      id: entry.id,
      deliverySession: entry.deliverySession,
      milkType: entry.milkType,
      quantity: Number(entry.quantity),
      notes: entry.notes,
      recordedAt: entry.updatedAt.toISOString(),
      recorder: entry.recorder,
    })),
    entries: entries.map((entry) => ({
      id: entry.id,
      villageId: entry.villageId,
      villageName: entry.village.name,
      farmerId: entry.farmerId,
      farmerName: entry.farmer.name,
      deliverySession: entry.deliverySession,
      quantity: Number(entry.quantity),
      notes: entry.notes,
      recordedAt: entry.updatedAt.toISOString(),
      recorder: entry.recorder,
    })),
  };
}

export async function getMilkCollectionTotalsByDate(date: Date) {
  const [farmerGrouped, individualTotals] = await Promise.all([
    prisma.milkCollection.groupBy({
      by: ['villageId', 'deliverySession'],
      where: { collectionDate: date },
      _sum: { quantity: true },
    }),
    prisma.villageIndividualCollection.findMany({
      where: { collectionDate: date },
      select: {
        villageId: true,
        deliverySession: true,
        quantity: true,
      },
    }),
  ]);

  const totals = { morning: 0, evening: 0, total: 0 };
  const farmerMap = new Map<string, number>();
  const recordedMap = new Map<string, number>();

  for (const row of farmerGrouped) {
    const key = `${row.villageId}|${row.deliverySession}`;
    farmerMap.set(key, Number(row._sum.quantity ?? 0));
  }

  for (const row of individualTotals) {
    const key = `${row.villageId}|${row.deliverySession}`;
    recordedMap.set(key, Number(row.quantity ?? 0));
  }

  const allKeys = new Set<string>([...farmerMap.keys(), ...recordedMap.keys()]);
  for (const key of allKeys) {
    const [, session] = key.split('|') as [string, 'morning' | 'evening'];
    const farmerQty = farmerMap.get(key) ?? 0;
    const recordedQty = recordedMap.get(key);
    const effectiveQty = recordedQty ?? farmerQty;

    totals[session] += effectiveQty;
    totals.total += effectiveQty;
  }

  return {
    morning: Number(totals.morning.toFixed(3)),
    evening: Number(totals.evening.toFixed(3)),
    total: Number(totals.total.toFixed(3)),
  };
}
