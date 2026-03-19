import { prisma } from '../../index.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { CreateVillageInput, SaveMilkCollectionInput } from './milk-collections.types.js';

export async function listVillages() {
  return prisma.village.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function createVillage(input: CreateVillageInput) {
  const name = input.name.trim();
  const existing = await prisma.village.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });

  if (existing) {
    throw new ConflictError('Village already exists');
  }

  return prisma.village.create({
    data: { name },
  });
}

export async function saveMilkCollection(input: SaveMilkCollectionInput, userId: string) {
  const village = await prisma.village.findUnique({
    where: { id: input.villageId },
  });

  if (!village) throw new NotFoundError('Village not found');
  if (!village.isActive) throw new ValidationError('Cannot record collection for an inactive village');

  const collectionDate = new Date(input.collectionDate);

  return prisma.milkCollection.upsert({
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
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.milkCollection.findMany({
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
  ]);

  const shiftTotals = {
    morning: 0,
    evening: 0,
  };

  const villageRows = villages.map((village) => ({
    villageId: village.id,
    villageName: village.name,
    isActive: village.isActive,
    morningQuantity: 0,
    eveningQuantity: 0,
    totalQuantity: 0,
  }));

  const villageRowMap = new Map(villageRows.map((row) => [row.villageId, row]));

  for (const entry of entries) {
    const quantity = Number(entry.quantity);
    shiftTotals[entry.deliverySession] += quantity;

    const row = villageRowMap.get(entry.villageId);
    if (!row) continue;

    if (entry.deliverySession === 'morning') row.morningQuantity += quantity;
    if (entry.deliverySession === 'evening') row.eveningQuantity += quantity;
    row.totalQuantity += quantity;
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
    entries: entries.map((entry) => ({
      id: entry.id,
      villageId: entry.villageId,
      villageName: entry.village.name,
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

  const totals = {
    morning: 0,
    evening: 0,
    total: 0,
  };

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
