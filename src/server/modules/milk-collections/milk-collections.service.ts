import { prisma } from '../../index.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { CreateFarmerInput, CreateVillageInput, SaveMilkCollectionInput, UpdateFarmerInput } from './milk-collections.types.js';

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

export async function deleteMilkCollection(id: string) {
  const existing = await prisma.milkCollection.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Milk collection entry not found');

  await prisma.milkCollection.delete({ where: { id } });
  return { id };
}

export async function getMilkCollectionSummary(date: string) {
  const targetDate = new Date(date);
  const [villages, entries] = await Promise.all([
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
  ]);

  const shiftTotals = { morning: 0, evening: 0 };

  const villageRows = villages.map((village) => ({
    villageId: village.id,
    villageName: village.name,
    isActive: village.isActive,
    morningQuantity: 0,
    eveningQuantity: 0,
    totalQuantity: 0,
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
    shiftTotals[entry.deliverySession] += quantity;

    const villageRow = villageRowMap.get(entry.villageId);
    if (villageRow) {
      if (entry.deliverySession === 'morning') villageRow.morningQuantity += quantity;
      if (entry.deliverySession === 'evening') villageRow.eveningQuantity += quantity;
      villageRow.totalQuantity += quantity;
    }

    const farmerRow = farmerRowMap.get(entry.farmerId);
    if (farmerRow) {
      if (entry.deliverySession === 'morning') farmerRow.morningQuantity += quantity;
      if (entry.deliverySession === 'evening') farmerRow.eveningQuantity += quantity;
      farmerRow.totalQuantity += quantity;
    }
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
  const grouped = await prisma.milkCollection.groupBy({
    by: ['deliverySession'],
    where: { collectionDate: date },
    _sum: { quantity: true },
  });

  const totals = { morning: 0, evening: 0, total: 0 };

  for (const row of grouped) {
    const quantity = Number(row._sum.quantity ?? 0);
    totals[row.deliverySession] = quantity;
    totals.total += quantity;
  }

  return {
    morning: Number(totals.morning.toFixed(3)),
    evening: Number(totals.evening.toFixed(3)),
    total: Number(totals.total.toFixed(3)),
  };
}
