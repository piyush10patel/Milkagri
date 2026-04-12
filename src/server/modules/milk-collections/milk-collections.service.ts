import { prisma } from '../../index.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type {
  AssignCollectionRouteAgentsInput,
  CollectionRouteManifestQuery,
  CreateFarmerInput,
  CreateVillageStopInput,
  CreateVillageInput,
  SaveCollectionRouteStopsInput,
  SaveMilkCollectionInput,
  SaveMilkVehicleLoadInput,
  SaveMilkVehicleShiftLoadInput,
  SaveVillageIndividualCollectionInput,
  UpdateFarmerInput,
  UpdateVillageStopInput,
} from './milk-collections.types.js';

function prismaAny() {
  return prisma as any;
}

function formatAssignedAgents(
  route: { routeAgents?: Array<{ user: { name: string; role?: string; isActive?: boolean } }> },
) {
  return (route.routeAgents ?? [])
    .filter((assignment) => (assignment.user.isActive ?? true) && (assignment.user.role ?? 'delivery_agent') === 'delivery_agent')
    .map((assignment) => assignment.user.name);
}

function villageSessionKey(villageId: string, deliverySession: 'morning' | 'evening') {
  return `${villageId}:${deliverySession}`;
}

export async function listVillages() {
  return prismaAny().village.findMany({
    include: {
      stops: {
        where: { isActive: true },
        include: {
          farmers: {
            include: {
              farmer: {
                select: { id: true, name: true, isActive: true },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      },
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
    select: {
      id: true,
      name: true,
      routeAgents: {
        include: {
          user: {
            select: { id: true, name: true, role: true, isActive: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  }).then((routes) =>
    routes.map((route) => ({
      id: route.id,
      name: route.name,
      agentIds: route.routeAgents
        .filter((assignment) => assignment.user.isActive && assignment.user.role === 'delivery_agent')
        .map((assignment) => assignment.user.id),
      agentNames: formatAssignedAgents(route),
    })),
  );
}

async function getVillageRouteAssignmentsByDate(_targetDate: Date) {
  const routeStops = await prismaAny().milkCollectionRouteStop.findMany({
    include: {
      route: {
        select: {
          id: true,
          name: true,
          routeAgents: {
            include: {
              user: {
                select: { id: true, name: true, role: true, isActive: true },
              },
            },
          },
        },
      },
    },
  });

  const byVillageAndSession = new Map<
    string,
    { routeId: string; routeName: string; agentNames: string[]; deliverySession: 'morning' | 'evening' }
  >();

  for (const stop of routeStops) {
    byVillageAndSession.set(villageSessionKey(stop.villageId, stop.deliverySession), {
      routeId: stop.route.id,
      routeName: stop.route.name,
      agentNames: formatAssignedAgents(stop.route),
      deliverySession: stop.deliverySession,
    });
  }

  return { byVillageAndSession };
}

export async function getCollectionRouteStops(
  routeId: string,
  deliverySession: 'morning' | 'evening',
) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    select: {
      id: true,
      name: true,
      isActive: true,
      routeAgents: {
        include: {
          user: {
            select: { id: true, name: true, role: true, isActive: true },
          },
        },
      },
    },
  });
  if (!route) throw new NotFoundError('Route not found');

  const stops = await prismaAny().milkCollectionRouteStop.findMany({
    where: { routeId, deliverySession },
    include: {
      villageStop: {
        select: {
          id: true,
          name: true,
          isActive: true,
          farmers: {
            include: {
              farmer: {
                select: { id: true, name: true, isActive: true },
              },
            },
          },
        },
      },
      farmers: {
        include: {
          farmer: {
            select: { id: true, name: true, isActive: true },
          },
        },
      },
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
    route: {
      id: route.id,
      name: route.name,
      isActive: route.isActive,
      agentIds: route.routeAgents
        .filter((assignment) => assignment.user.isActive && assignment.user.role === 'delivery_agent')
        .map((assignment) => assignment.user.id),
      agentNames: formatAssignedAgents(route),
    },
    deliverySession,
    stops: stops.map((stop: any) => ({
      id: stop.id,
      villageStopId: stop.villageStopId,
      stopName: stop.villageStop?.name ?? `${stop.village.name} Main`,
      villageId: stop.villageId,
      villageName: stop.village.name,
      sequenceOrder: stop.sequenceOrder,
      farmerIds: stop.farmers.map((stopFarmer: any) => stopFarmer.farmerId),
      defaultFarmerIds:
        stop.villageStop?.farmers?.length
          ? stop.villageStop.farmers
              .map((stopFarmer: any) => stopFarmer.farmer)
              .filter((farmer: any) => farmer?.isActive)
              .map((farmer: any) => farmer.id)
          : [],
      farmerNames: (() => {
        const routeStopFarmerNames = stop.farmers
          .map((stopFarmer: any) => stopFarmer.farmer)
          .filter((farmer: any) => farmer?.isActive)
          .map((farmer: any) => farmer.name);
        const villageStopFarmerNames = (stop.villageStop?.farmers ?? [])
          .map((stopFarmer: any) => stopFarmer.farmer)
          .filter((farmer: any) => farmer?.isActive)
          .map((farmer: any) => farmer.name);
        const villageFarmerNames = stop.village.farmers.map((farmer: any) => farmer.name);

        const merged = [...routeStopFarmerNames, ...villageStopFarmerNames];
        if (merged.length > 0) return Array.from(new Set(merged));
        return villageFarmerNames;
      })(),
      availableFarmers: stop.village.farmers.map((farmer: any) => ({
        id: farmer.id,
        name: farmer.name,
      })),
    })),
  };
}

export async function saveCollectionRouteStops(input: SaveCollectionRouteStopsInput) {
  const route = await prisma.route.findUnique({
    where: { id: input.routeId },
    select: { id: true, name: true, isActive: true },
  });
  if (!route) throw new NotFoundError('Route not found');

  const villageStopIds = input.stops.map((stop) => stop.villageStopId);
  if (new Set(villageStopIds).size !== villageStopIds.length) {
    throw new ValidationError('Duplicate village stops in collection route stops');
  }

  const sequenceOrders = input.stops.map((stop) => stop.sequenceOrder);
  if (new Set(sequenceOrders).size !== sequenceOrders.length) {
    throw new ValidationError('Duplicate sequence orders in collection route stops');
  }

  if (villageStopIds.length > 0) {
    const villageStops = await prismaAny().villageCollectionStop.findMany({
      where: { id: { in: villageStopIds } },
      select: { id: true, villageId: true, isActive: true, name: true },
    });
    if (villageStops.length !== villageStopIds.length) {
      throw new NotFoundError('One or more village stops were not found');
    }
    const inactive = villageStops.find((stop: any) => !stop.isActive);
    if (inactive) {
      throw new ValidationError('Inactive village stops cannot be added to collection route');
    }

    const conflictingStops = await prismaAny().milkCollectionRouteStop.findMany({
      where: {
        deliverySession: input.deliverySession,
        villageStopId: { in: villageStopIds },
        routeId: { not: input.routeId },
      },
      include: {
        villageStop: { select: { id: true, name: true } },
        route: { select: { id: true, name: true } },
      },
    });

    if (conflictingStops.length > 0) {
      const details = conflictingStops
        .map((stop: any) => `${stop.villageStop?.name ?? 'Unknown stop'} -> ${stop.route.name}`)
        .join(', ');
      throw new ValidationError(
        `Each village stop can be assigned to only one collection route per shift. Conflicts: ${details}`,
      );
    }

    const stopVillageMap = new Map(villageStops.map((stop: any) => [stop.id, stop.villageId]));
    const allFarmerIds = input.stops.flatMap((stop) => stop.farmerIds ?? []);
    if (allFarmerIds.length > 0) {
      const farmers = await prisma.farmer.findMany({
        where: { id: { in: allFarmerIds } },
        select: { id: true, villageId: true, isActive: true },
      });
      if (farmers.length !== allFarmerIds.length) {
        throw new NotFoundError('One or more selected farmers were not found');
      }
      const farmerMap = new Map(farmers.map((farmer) => [farmer.id, farmer]));
      for (const stop of input.stops) {
        const uniqueFarmerIds = new Set(stop.farmerIds ?? []);
        const stopVillageId = stopVillageMap.get(stop.villageStopId);
        if (!stopVillageId) throw new NotFoundError('One or more village stops were not found');
        for (const farmerId of uniqueFarmerIds) {
          const farmer = farmerMap.get(farmerId);
          if (!farmer) {
            throw new NotFoundError('One or more selected farmers were not found');
          }
          if (!farmer.isActive) {
            throw new ValidationError('Inactive farmers cannot be assigned to route stops');
          }
          if (farmer.villageId !== stopVillageId) {
            throw new ValidationError('Selected farmers must belong to the same village as the stop');
          }
        }
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await (tx as any).milkCollectionRouteStop.deleteMany({
      where: { routeId: input.routeId, deliverySession: input.deliverySession },
    });

    if (input.stops.length > 0) {
      for (const stop of input.stops) {
        const villageStop = await (tx as any).villageCollectionStop.findUnique({
          where: { id: stop.villageStopId },
          select: { id: true, villageId: true },
        });
        if (!villageStop) throw new NotFoundError('One or more village stops were not found');

        const createdStop = await (tx as any).milkCollectionRouteStop.create({
          data: {
            routeId: input.routeId,
            villageId: villageStop.villageId,
            villageStopId: villageStop.id,
            deliverySession: input.deliverySession,
            sequenceOrder: stop.sequenceOrder,
          },
        });

        const uniqueFarmerIds = Array.from(new Set(stop.farmerIds ?? []));
        if (uniqueFarmerIds.length > 0) {
          await (tx as any).milkCollectionRouteStopFarmer.createMany({
            data: uniqueFarmerIds.map((farmerId) => ({
              stopId: createdStop.id,
              farmerId,
            })),
          });
        }
      }
    }
  });

  return getCollectionRouteStops(input.routeId, input.deliverySession);
}

export async function assignCollectionRouteAgents(input: AssignCollectionRouteAgentsInput) {
  const route = await prisma.route.findUnique({ where: { id: input.routeId } });
  if (!route) throw new NotFoundError('Route not found');

  if (input.agentIds.length > 0) {
    const agents = await prisma.user.findMany({
      where: { id: { in: input.agentIds }, isActive: true },
      select: { id: true, role: true },
    });
    const agentMap = new Map(agents.map((agent) => [agent.id, agent.role]));
    for (const agentId of input.agentIds) {
      if (!agentMap.has(agentId)) {
        throw new NotFoundError(`Agent not found or inactive: ${agentId}`);
      }
      if (agentMap.get(agentId) !== 'delivery_agent') {
        throw new ValidationError('Only delivery agents can be assigned to collection routes');
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.routeAgent.deleteMany({ where: { routeId: input.routeId } });
    if (input.agentIds.length > 0) {
      await tx.routeAgent.createMany({
        data: input.agentIds.map((userId) => ({ routeId: input.routeId, userId })),
      });
    }
  });

  const updated = await prisma.route.findUnique({
    where: { id: input.routeId },
    select: {
      id: true,
      name: true,
      routeAgents: {
        include: {
          user: {
            select: { id: true, name: true, role: true, isActive: true },
          },
        },
      },
    },
  });

  if (!updated) throw new NotFoundError('Route not found');

  return {
    routeId: updated.id,
    routeName: updated.name,
    agentIds: updated.routeAgents
      .filter((assignment) => assignment.user.isActive && assignment.user.role === 'delivery_agent')
      .map((assignment) => assignment.user.id),
    agentNames: formatAssignedAgents(updated),
  };
}

export async function getCollectionRouteManifest(query: CollectionRouteManifestQuery) {
  const route = await prisma.route.findUnique({
    where: { id: query.routeId },
    select: {
      id: true,
      name: true,
      routeAgents: {
        include: {
          user: {
            select: { id: true, name: true, role: true, isActive: true },
          },
        },
      },
    },
  });
  if (!route) throw new NotFoundError('Route not found');

  const stops = await prismaAny().milkCollectionRouteStop.findMany({
    where: {
      routeId: query.routeId,
      deliverySession: query.deliverySession,
    },
    include: {
      villageStop: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          farmers: {
            include: {
              farmer: {
                select: { id: true, name: true, isActive: true },
              },
            },
          },
        },
      },
      farmers: {
        include: {
          farmer: {
            select: { id: true, name: true, isActive: true },
          },
        },
      },
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
    agentNames: formatAssignedAgents(route),
    date: query.date,
    deliverySession: query.deliverySession,
    totalStops: stops.length,
    stops: stops.map((stop: any) => {
      const routeStopFarmerNames = stop.farmers
        .map((stopFarmer: any) => stopFarmer.farmer)
        .filter((farmer: any) => farmer?.isActive)
        .map((farmer: any) => farmer.name);
      const villageStopFarmerNames = (stop.villageStop?.farmers ?? [])
        .map((stopFarmer: any) => stopFarmer.farmer)
        .filter((farmer: any) => farmer?.isActive)
        .map((farmer: any) => farmer.name);
      const villageFarmerNames = stop.village.farmers.map((farmer: any) => farmer.name);
      const mergedStopFarmerNames = Array.from(new Set([...routeStopFarmerNames, ...villageStopFarmerNames]));
      const farmerNames = mergedStopFarmerNames.length > 0 ? mergedStopFarmerNames : villageFarmerNames;

      return {
        sequenceOrder: stop.sequenceOrder,
        villageStopId: stop.villageStopId,
        stopName: stop.villageStop?.name ?? `${stop.village.name} Main`,
        villageId: stop.villageId,
        villageName: stop.village.name,
        latitude:
          stop.villageStop?.latitude !== null && stop.villageStop?.latitude !== undefined
            ? Number(stop.villageStop.latitude)
            : null,
        longitude:
          stop.villageStop?.longitude !== null && stop.villageStop?.longitude !== undefined
            ? Number(stop.villageStop.longitude)
            : null,
        farmerNames,
        farmerCount: farmerNames.length,
      };
    }),
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

export async function deleteVillage(id: string) {
  const existing = await prisma.village.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          milkCollections: true,
          individualCollections: true,
          vehicleLoads: true,
        },
      },
    },
  });
  if (!existing) throw new NotFoundError('Village not found');

  const hasRecords =
    existing._count.milkCollections > 0 ||
    existing._count.individualCollections > 0 ||
    existing._count.vehicleLoads > 0;

  if (hasRecords) {
    await prisma.village.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, mode: 'deactivated' as const };
  }

  // Hard delete — cascade will remove stops, stop-farmers, route-stops
  await prisma.village.delete({ where: { id } });
  return { id, mode: 'deleted' as const };
}

export async function createVillageStop(input: CreateVillageStopInput) {
  const village = await prisma.village.findUnique({ where: { id: input.villageId } });
  if (!village) throw new NotFoundError('Village not found');

  const name = input.name.trim();
  const existing = await prismaAny().villageCollectionStop.findFirst({
    where: {
      villageId: input.villageId,
      name: { equals: name, mode: 'insensitive' },
    },
  });
  if (existing) throw new ConflictError('Stop already exists for this village');

  const uniqueFarmerIds = Array.from(new Set(input.farmerIds ?? []));
  if (uniqueFarmerIds.length > 0) {
    const farmers = await prisma.farmer.findMany({
      where: { id: { in: uniqueFarmerIds } },
      select: { id: true, villageId: true, isActive: true },
    });
    if (farmers.length !== uniqueFarmerIds.length) {
      throw new NotFoundError('One or more selected farmers were not found');
    }
    const invalid = farmers.find((farmer) => !farmer.isActive || farmer.villageId !== input.villageId);
    if (invalid) {
      throw new ValidationError('Selected farmers must be active and belong to the selected village');
    }
  }

  return prisma.$transaction(async (tx) => {
    const stop = await (tx as any).villageCollectionStop.create({
      data: {
        villageId: input.villageId,
        name,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      },
    });
    if (uniqueFarmerIds.length > 0) {
      await (tx as any).villageCollectionStopFarmer.createMany({
        data: uniqueFarmerIds.map((farmerId) => ({
          stopId: stop.id,
          farmerId,
        })),
      });
    }
    return stop;
  });
}

export async function updateVillageStop(id: string, input: UpdateVillageStopInput) {
  const existing = await prismaAny().villageCollectionStop.findUnique({
    where: { id },
    include: { _count: { select: { routeStops: true } } },
  });
  if (!existing) throw new NotFoundError('Village stop not found');

  if (input.name !== undefined) {
    const duplicate = await prismaAny().villageCollectionStop.findFirst({
      where: {
        villageId: existing.villageId,
        id: { not: id },
        name: { equals: input.name.trim(), mode: 'insensitive' },
      },
    });
    if (duplicate) throw new ConflictError('Stop already exists for this village');
  }

  if (input.farmerIds !== undefined) {
    const uniqueFarmerIds = Array.from(new Set(input.farmerIds));
    if (uniqueFarmerIds.length > 0) {
      const farmers = await prisma.farmer.findMany({
        where: { id: { in: uniqueFarmerIds } },
        select: { id: true, villageId: true, isActive: true },
      });
      if (farmers.length !== uniqueFarmerIds.length) {
        throw new NotFoundError('One or more selected farmers were not found');
      }
      const invalid = farmers.find((farmer) => !farmer.isActive || farmer.villageId !== existing.villageId);
      if (invalid) {
        throw new ValidationError('Selected farmers must be active and belong to the same village');
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const stop = await (tx as any).villageCollectionStop.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    if (input.farmerIds !== undefined) {
      await (tx as any).villageCollectionStopFarmer.deleteMany({ where: { stopId: id } });
      const uniqueFarmerIds = Array.from(new Set(input.farmerIds));
      if (uniqueFarmerIds.length > 0) {
        await (tx as any).villageCollectionStopFarmer.createMany({
          data: uniqueFarmerIds.map((farmerId) => ({ stopId: id, farmerId })),
        });
      }
    }

    return stop;
  });
}

export async function deleteVillageStop(id: string) {
  const existing = await prismaAny().villageCollectionStop.findUnique({
    where: { id },
    include: { _count: { select: { routeStops: true } } },
  });
  if (!existing) throw new NotFoundError('Village stop not found');

  if (existing._count.routeStops > 0) {
    await prismaAny().villageCollectionStop.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, mode: 'deactivated' as const };
  }

  await prismaAny().villageCollectionStop.delete({ where: { id } });
  return { id, mode: 'deleted' as const };
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
  const [villages, entries, individualCollections, vehicleShiftLoads, villageRouteAssignmentsData] = await Promise.all([
    prismaAny().village.findMany({
      include: {
        stops: {
          where: { isActive: true },
          include: {
            farmers: {
              include: {
                farmer: {
                  select: { id: true, name: true, isActive: true },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
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
    getVillageRouteAssignmentsByDate(targetDate),
  ]);

  const shiftTotals = { morning: 0, evening: 0 };
  const villagesList = villages as any[];

  const villageRows = villagesList.map((village: any) => ({
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
    morningRouteName: null as string | null,
    morningAgentNames: [] as string[],
    eveningRouteName: null as string | null,
    eveningAgentNames: [] as string[],
  }));

  const farmerRows = villagesList.flatMap((village: any) =>
    village.farmers.map((farmer: any) => ({
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

  const villageRowMap = new Map(villageRows.map((row: any) => [row.villageId, row]));
  const farmerRowMap = new Map(farmerRows.map((row: any) => [row.farmerId, row]));

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

    const morningAssignment = villageRouteAssignmentsData.byVillageAndSession.get(
      villageSessionKey(villageRow.villageId, 'morning'),
    );
    if (morningAssignment) {
      villageRow.morningRouteName = morningAssignment.routeName;
      villageRow.morningAgentNames = morningAssignment.agentNames;
    }

    const eveningAssignment = villageRouteAssignmentsData.byVillageAndSession.get(
      villageSessionKey(villageRow.villageId, 'evening'),
    );
    if (eveningAssignment) {
      villageRow.eveningRouteName = eveningAssignment.routeName;
      villageRow.eveningAgentNames = eveningAssignment.agentNames;
    }

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
    villageRouteAssignments: villageRows.map((row: any) => ({
      villageId: row.villageId,
      villageName: row.villageName,
      morning: row.morningRouteName ? { routeName: row.morningRouteName, agentNames: row.morningAgentNames } : null,
      evening: row.eveningRouteName ? { routeName: row.eveningRouteName, agentNames: row.eveningAgentNames } : null,
    })),
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
