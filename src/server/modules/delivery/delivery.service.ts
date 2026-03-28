import { prisma } from '../../index.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import type { GpsLocationPingInput, UpdateDeliveryStatusInput } from './delivery.types.js';
import { Prisma } from '@prisma/client';

function isMissingGpsTableError(error: unknown): boolean {
  const maybeError = error as { code?: string; meta?: { table?: string } };
  return maybeError?.code === 'P2021' && maybeError?.meta?.table === 'public.vehicle_gps_pings';
}

function getDeliveredQuantity(order: { quantity: Prisma.Decimal; actualQuantity?: Prisma.Decimal | null }) {
  return Number(order.actualQuantity ?? order.quantity);
}

function getAdjustment(
  plannedQuantity: Prisma.Decimal,
  actualQuantity: Prisma.Decimal,
): {
  actualQuantity: Prisma.Decimal;
  adjustmentType: 'exact' | 'over' | 'under';
  adjustmentQuantity: Prisma.Decimal;
} {
  const difference = actualQuantity.sub(plannedQuantity);

  if (difference.gt(0)) {
    return {
      actualQuantity,
      adjustmentType: 'over',
      adjustmentQuantity: difference,
    };
  }

  if (difference.lt(0)) {
    return {
      actualQuantity,
      adjustmentType: 'under',
      adjustmentQuantity: difference.abs(),
    };
  }

  return {
    actualQuantity,
    adjustmentType: 'exact',
    adjustmentQuantity: new Prisma.Decimal(0),
  };
}

// ---------------------------------------------------------------------------
// Get flat manifest for the delivery page (used by both agents and admins).
// Admins see all orders for the date; agents see only their assigned routes.
// Returns { data: ManifestItem[] } matching the client's expected format.
// ---------------------------------------------------------------------------
export async function getManifestFlat(userId: string, date: string, isAdmin: boolean) {
  const deliveryDate = new Date(date + 'T00:00:00.000Z');

  const where: Prisma.DeliveryOrderWhereInput = { deliveryDate };

  if (!isAdmin) {
    // Filter by routes assigned to this agent
    const routeAgents = await prisma.routeAgent.findMany({
      where: { userId },
      select: { routeId: true },
    });
    const routeIds = routeAgents.map((ra) => ra.routeId);
    if (routeIds.length === 0) {
      return { data: [] };
    }
    where.routeId = { in: routeIds };
  }

  const orders = await prisma.deliveryOrder.findMany({
    where,
    orderBy: [{ route: { name: 'asc' } }, { createdAt: 'asc' }],
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          deliveryNotes: true,
          addresses: { where: { isPrimary: true }, take: 1 },
        },
      },
      productVariant: {
        include: { product: { select: { id: true, name: true } } },
      },
      packs: {
        select: {
          id: true,
          packSize: true,
          packCount: true,
        },
        orderBy: { packSize: 'desc' },
      },
      route: { select: { id: true, name: true } },
    },
  });

  const routeCustomerFilters = orders
    .filter((order) => order.routeId)
    .map((order) => ({
      routeId: order.routeId!,
      customerId: order.customerId,
    }));

  const routeCustomerSequences =
    routeCustomerFilters.length > 0
      ? await prisma.routeCustomer.findMany({
          where: { OR: routeCustomerFilters },
          select: {
            routeId: true,
            customerId: true,
            sequenceOrder: true,
            plannedDropQuantity: true,
            dropLatitude: true,
            dropLongitude: true,
          },
        })
      : [];

  const sequenceMap = new Map<
    string,
    {
      sequenceOrder: number;
      plannedDropQuantity: number | null;
      dropLatitude: number | null;
      dropLongitude: number | null;
    }
  >();
  for (const routeCustomer of routeCustomerSequences) {
    sequenceMap.set(`${routeCustomer.routeId}:${routeCustomer.customerId}`, {
      sequenceOrder: routeCustomer.sequenceOrder,
      plannedDropQuantity:
        routeCustomer.plannedDropQuantity !== null ? Number(routeCustomer.plannedDropQuantity) : null,
      dropLatitude: routeCustomer.dropLatitude !== null ? Number(routeCustomer.dropLatitude) : null,
      dropLongitude: routeCustomer.dropLongitude !== null ? Number(routeCustomer.dropLongitude) : null,
    });
  }

  const data = orders.map((o, idx) => {
    const stopMeta = o.routeId ? sequenceMap.get(`${o.routeId}:${o.customerId}`) : null;
    const hasDropCoords =
      typeof stopMeta?.dropLatitude === 'number' && typeof stopMeta?.dropLongitude === 'number';
    return ({
    routeId: o.route?.id ?? null,
    routeName: o.route?.name ?? null,
    id: o.id,
    customer: {
      id: o.customer.id,
      name: o.customer.name,
      phone: o.customer.phone,
      deliveryNotes: o.customer.deliveryNotes,
    },
    customerAddress: o.customer.addresses[0]
      ? {
          addressLine1: o.customer.addresses[0].addressLine1,
          addressLine2: o.customer.addresses[0].addressLine2,
          city: o.customer.addresses[0].city,
          latitude: o.customer.addresses[0].latitude ? Number(o.customer.addresses[0].latitude) : null,
          longitude: o.customer.addresses[0].longitude ? Number(o.customer.addresses[0].longitude) : null,
        }
      : undefined,
    productVariant: {
      id: o.productVariant.id,
      product: { name: o.productVariant.product.name },
      unitType: o.productVariant.unitType,
      quantityPerUnit: o.productVariant.quantityPerUnit,
    },
    deliverySession: o.deliverySession,
    packBreakdown: o.packs.map((pack) => ({
      id: pack.id,
      packSize: pack.packSize,
      packCount: pack.packCount,
    })),
    quantity: Number(o.quantity),
    actualQuantity: getDeliveredQuantity(o as { quantity: Prisma.Decimal; actualQuantity?: Prisma.Decimal | null }),
    status: o.status,
    adjustmentType: (o as { adjustmentType?: 'exact' | 'over' | 'under' | null }).adjustmentType,
    adjustmentQuantity: Number((o as { adjustmentQuantity?: Prisma.Decimal | null }).adjustmentQuantity ?? 0),
    skipReason: o.skipReason,
    failureReason: o.failureReason,
    returnedQuantity: o.returnedQuantity ? Number(o.returnedQuantity) : undefined,
    deliveryNotes: o.deliveryNotes,
    sequenceOrder: stopMeta?.sequenceOrder ?? idx + 1,
    plannedDropQuantity: stopMeta?.plannedDropQuantity ?? null,
    dropLocation: hasDropCoords
      ? {
          latitude: stopMeta.dropLatitude,
          longitude: stopMeta.dropLongitude,
        }
      : null,
  })});

  return { data };
}

// ---------------------------------------------------------------------------
// Get agent's manifest for a date (Req 7.1, 7.2)
// Returns delivery orders ordered by route sequence for routes assigned to
// the given agent.
// ---------------------------------------------------------------------------
export async function getAgentManifest(agentId: string, date: string) {
  const deliveryDate = new Date(date + 'T00:00:00.000Z');

  // Find routes assigned to this agent
  const routeAgents = await prisma.routeAgent.findMany({
    where: { userId: agentId },
    select: { routeId: true },
  });

  const routeIds = routeAgents.map((ra) => ra.routeId);
  if (routeIds.length === 0) {
    return { date, routes: [] };
  }

  // For each route, get customers in sequence order and their delivery orders
  const routes = await prisma.route.findMany({
    where: { id: { in: routeIds } },
    select: { id: true, name: true },
  });

  const result = [];

  for (const route of routes) {
    const routeCustomers = await prisma.routeCustomer.findMany({
      where: { routeId: route.id },
      orderBy: { sequenceOrder: 'asc' },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            deliveryNotes: true,
            addresses: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    });

    const orders = await prisma.deliveryOrder.findMany({
      where: { routeId: route.id, deliveryDate },
      include: {
        productVariant: {
          include: { product: { select: { name: true } } },
        },
        packs: {
          select: {
            id: true,
            packSize: true,
            packCount: true,
          },
          orderBy: { packSize: 'desc' },
        },
      },
    });

    // Group orders by customer
    const ordersByCustomer = new Map<string, typeof orders>();
    for (const order of orders) {
      const list = ordersByCustomer.get(order.customerId) ?? [];
      list.push(order);
      ordersByCustomer.set(order.customerId, list);
    }

    const stops = routeCustomers
      .filter((rc) => {
        // Only include stops that have orders for this date
        return (ordersByCustomer.get(rc.customer.id) ?? []).length > 0;
      })
      .map((rc) => {
        const customer = rc.customer;
        const addr = customer.addresses[0] ?? null;
        const customerOrders = ordersByCustomer.get(customer.id) ?? [];

        return {
          sequenceOrder: rc.sequenceOrder,
          customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            deliveryNotes: customer.deliveryNotes,
            address: addr
              ? {
                  addressLine1: addr.addressLine1,
                  addressLine2: addr.addressLine2,
                  city: addr.city,
                  state: addr.state,
                  pincode: addr.pincode,
                }
              : null,
          },
          orders: customerOrders.map((o) => ({
            id: o.id,
            productName: o.productVariant.product.name,
            unitType: o.productVariant.unitType,
            quantityPerUnit: o.productVariant.quantityPerUnit,
            quantity: o.quantity,
            actualQuantity: (o as { actualQuantity?: Prisma.Decimal | null }).actualQuantity,
            deliverySession: o.deliverySession,
            packBreakdown: o.packs.map((pack) => ({
              id: pack.id,
              packSize: pack.packSize,
              packCount: pack.packCount,
            })),
            status: o.status,
            adjustmentType: (o as { adjustmentType?: 'exact' | 'over' | 'under' | null }).adjustmentType,
            adjustmentQuantity: (o as { adjustmentQuantity?: Prisma.Decimal | null }).adjustmentQuantity,
            skipReason: o.skipReason,
            failureReason: o.failureReason,
            returnedQuantity: o.returnedQuantity,
            deliveryNotes: o.deliveryNotes,
          })),
        };
      });

    result.push({
      routeId: route.id,
      routeName: route.name,
      stops,
    });
  }

  return { date, routes: result };
}

// ---------------------------------------------------------------------------
// Mark delivery status (Req 7.3, 7.4, 7.5, 7.6)
// ---------------------------------------------------------------------------
export async function markDeliveryStatus(
  orderId: string,
  input: UpdateDeliveryStatusInput,
  agentId: string,
) {
  const order = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Delivery order not found');

  if (order.status !== 'pending') {
    throw new ValidationError('Can only update status of pending delivery orders', {
      status: [`Current status is '${order.status}'`],
    });
  }

  const data: Prisma.DeliveryOrderUpdateInput & {
    actualQuantity?: Prisma.Decimal | null;
    adjustmentType?: 'exact' | 'over' | 'under' | null;
    adjustmentQuantity?: Prisma.Decimal | null;
  } = {
    status: input.status,
    deliverer: { connect: { id: agentId } },
    deliveredAt: new Date(),
  };

  if (input.status === 'delivered') {
    const actualQuantity = new Prisma.Decimal(
      (input.actualQuantity ?? Number(order.quantity)).toString(),
    );
    const adjustment = getAdjustment(order.quantity, actualQuantity);

    data.actualQuantity = adjustment.actualQuantity;
    data.adjustmentType = adjustment.adjustmentType;
    data.adjustmentQuantity = adjustment.adjustmentQuantity;
    data.skipReason = null;
    data.failureReason = null;
    data.returnedQuantity = null;
  }

  if (input.status === 'skipped') {
    data.skipReason = input.skipReason ?? null;
    data.actualQuantity = null;
    data.adjustmentType = null;
    data.adjustmentQuantity = null;
    data.failureReason = null;
    data.returnedQuantity = null;
  }
  if (input.status === 'failed') {
    data.failureReason = input.failureReason ?? null;
    data.actualQuantity = null;
    data.adjustmentType = null;
    data.adjustmentQuantity = null;
    data.skipReason = null;
    data.returnedQuantity = null;
  }
  if (input.status === 'returned') {
    data.returnedQuantity = input.returnedQuantity ?? null;
    data.actualQuantity = null;
    data.adjustmentType = null;
    data.adjustmentQuantity = null;
    data.skipReason = null;
    data.failureReason = null;
  }

  return prisma.deliveryOrder.update({
    where: { id: orderId },
    data,
    include: {
      customer: { select: { id: true, name: true } },
      productVariant: {
        select: {
          id: true,
          unitType: true,
          quantityPerUnit: true,
          product: { select: { name: true } },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Add delivery notes (Req 7.7)
// ---------------------------------------------------------------------------
export async function addDeliveryNotes(orderId: string, notes: string) {
  const order = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Delivery order not found');

  return prisma.deliveryOrder.update({
    where: { id: orderId },
    data: { deliveryNotes: notes },
  });
}

// ---------------------------------------------------------------------------
// End-of-day reconciliation summary (Req 7.9)
// Totals by product variant and status for the agent's routes on a date.
// ---------------------------------------------------------------------------
export async function getReconciliation(agentId: string, date: string) {
  const deliveryDate = new Date(date + 'T00:00:00.000Z');

  // Find routes assigned to this agent
  const routeAgents = await prisma.routeAgent.findMany({
    where: { userId: agentId },
    select: { routeId: true },
  });
  const routeIds = routeAgents.map((ra) => ra.routeId);

  if (routeIds.length === 0) {
    return { date, totals: [], summary: { delivered: 0, skipped: 0, failed: 0, returned: 0, pending: 0 } };
  }

  const orders = await prisma.deliveryOrder.findMany({
    where: { routeId: { in: routeIds }, deliveryDate },
    include: {
      productVariant: {
        include: { product: { select: { name: true } } },
      },
    },
  });

  // Group by product variant and status
  const byVariant = new Map<
    string,
    {
      productVariantId: string;
      productName: string;
      unitType: string;
      quantityPerUnit: unknown;
      delivered: number;
      skipped: number;
      failed: number;
      returned: number;
      pending: number;
      returnedQuantity: number;
    }
  >();

  const overallSummary = { delivered: 0, skipped: 0, failed: 0, returned: 0, pending: 0 };

  for (const order of orders) {
    const key = order.productVariantId;
    if (!byVariant.has(key)) {
      byVariant.set(key, {
        productVariantId: key,
        productName: order.productVariant.product.name,
        unitType: order.productVariant.unitType,
        quantityPerUnit: order.productVariant.quantityPerUnit,
        delivered: 0,
        skipped: 0,
        failed: 0,
        returned: 0,
        pending: 0,
        returnedQuantity: 0,
      });
    }

    const entry = byVariant.get(key)!;
    const qty = Number(order.quantity);

    switch (order.status) {
      case 'delivered':
        entry.delivered += getDeliveredQuantity(order as { quantity: Prisma.Decimal; actualQuantity?: Prisma.Decimal | null });
        overallSummary.delivered++;
        break;
      case 'skipped':
        entry.skipped += qty;
        overallSummary.skipped++;
        break;
      case 'failed':
        entry.failed += qty;
        overallSummary.failed++;
        break;
      case 'returned':
        entry.returned += qty;
        entry.returnedQuantity += Number(order.returnedQuantity ?? 0);
        overallSummary.returned++;
        break;
      default:
        entry.pending += qty;
        overallSummary.pending++;
    }
  }

  return {
    date,
    totals: [...byVariant.values()],
    summary: overallSummary,
  };
}

// ---------------------------------------------------------------------------
// Admin overview — all routes/agents status for a date (Req 7.10)
// ---------------------------------------------------------------------------
export async function getAdminOverview(date: string) {
  const deliveryDate = new Date(date + 'T00:00:00.000Z');

  const routes = await prisma.route.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      routeAgents: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  const orders = await prisma.deliveryOrder.findMany({
    where: { deliveryDate },
    select: { id: true, routeId: true, status: true },
  });

  // Group orders by route
  const ordersByRoute = new Map<string | null, typeof orders>();
  for (const order of orders) {
    const key = order.routeId;
    const list = ordersByRoute.get(key) ?? [];
    list.push(order);
    ordersByRoute.set(key, list);
  }

  const routeOverviews = routes.map((route) => {
    const routeOrders = ordersByRoute.get(route.id) ?? [];
    const statusCounts = { pending: 0, delivered: 0, skipped: 0, failed: 0, returned: 0 };
    for (const o of routeOrders) {
      statusCounts[o.status as keyof typeof statusCounts]++;
    }

    return {
      routeId: route.id,
      routeName: route.name,
      agents: route.routeAgents.map((ra) => ({
        id: ra.user.id,
        name: ra.user.name,
      })),
      totalOrders: routeOrders.length,
      ...statusCounts,
    };
  });

  // Unassigned orders (no route)
  const unassigned = ordersByRoute.get(null) ?? [];
  const unassignedCounts = { pending: 0, delivered: 0, skipped: 0, failed: 0, returned: 0 };
  for (const o of unassigned) {
    unassignedCounts[o.status as keyof typeof unassignedCounts]++;
  }

  return {
    date,
    routes: routeOverviews,
    unassigned: {
      totalOrders: unassigned.length,
      ...unassignedCounts,
    },
  };
}

// ---------------------------------------------------------------------------
// Save GPS location ping from app/device
// ---------------------------------------------------------------------------
export async function saveLocationPing(userId: string, input: GpsLocationPingInput) {
  if (input.routeId) {
    const route = await prisma.route.findUnique({
      where: { id: input.routeId },
      select: { id: true },
    });
    if (!route) throw new NotFoundError('Route not found');
  }

  const pingAt = input.capturedAt ? new Date(input.capturedAt) : new Date();

  let ping;
  try {
    ping = await prisma.vehicleGpsPing.create({
      data: {
        userId,
        routeId: input.routeId,
        latitude: new Prisma.Decimal(input.latitude),
        longitude: new Prisma.Decimal(input.longitude),
        accuracyMeters:
          input.accuracyMeters === undefined ? null : new Prisma.Decimal(input.accuracyMeters),
        speedKmph: input.speedKmph === undefined ? null : new Prisma.Decimal(input.speedKmph),
        headingDegrees:
          input.headingDegrees === undefined ? null : new Prisma.Decimal(input.headingDegrees),
        deliverySession: input.deliverySession,
        pingAt,
      },
      select: {
        id: true,
        userId: true,
        routeId: true,
        latitude: true,
        longitude: true,
        accuracyMeters: true,
        speedKmph: true,
        headingDegrees: true,
        deliverySession: true,
        pingAt: true,
      },
    });
  } catch (error) {
    if (isMissingGpsTableError(error)) {
      throw new ValidationError('GPS tracking is not initialized. Run database migration and restart server.');
    }
    throw error;
  }

  return {
    ...ping,
    latitude: Number(ping.latitude),
    longitude: Number(ping.longitude),
    accuracyMeters: ping.accuracyMeters ? Number(ping.accuracyMeters) : null,
    speedKmph: ping.speedKmph ? Number(ping.speedKmph) : null,
    headingDegrees: ping.headingDegrees ? Number(ping.headingDegrees) : null,
  };
}

// ---------------------------------------------------------------------------
// Live vehicle locations for super_admin/admin monitoring
// ---------------------------------------------------------------------------
export async function getLiveLocations(minutes = 120) {
  const now = new Date();
  const clampedMinutes = Math.max(5, Math.min(720, minutes));
  const since = new Date(now.getTime() - clampedMinutes * 60 * 1000);

  let pings: Array<{
    id: string;
    userId: string;
    routeId: string | null;
    deliverySession: 'morning' | 'evening' | null;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    accuracyMeters: Prisma.Decimal | null;
    speedKmph: Prisma.Decimal | null;
    headingDegrees: Prisma.Decimal | null;
    pingAt: Date;
    recorder: { id: string; name: string; role: string };
    route: { id: string; name: string } | null;
  }> = [];
  try {
    pings = await prisma.vehicleGpsPing.findMany({
      where: { pingAt: { gte: since } },
      orderBy: [{ pingAt: 'desc' }],
      include: {
        recorder: {
          select: { id: true, name: true, role: true },
        },
        route: {
          select: { id: true, name: true },
        },
      },
      take: 4000,
    });
  } catch (error) {
    if (!isMissingGpsTableError(error)) {
      throw error;
    }
    return {
      generatedAt: now.toISOString(),
      minutesWindow: clampedMinutes,
      activeVehicles: 0,
      vehicles: [],
      trackingReady: false,
    };
  }

  const byUser = new Map<
    string,
    {
      user: { id: string; name: string; role: string };
      latestPingAt: string;
      latest: {
        latitude: number;
        longitude: number;
        accuracyMeters: number | null;
        speedKmph: number | null;
        headingDegrees: number | null;
        routeId: string | null;
        routeName: string | null;
        deliverySession: 'morning' | 'evening' | null;
      };
      trail: Array<{
        latitude: number;
        longitude: number;
        pingAt: string;
      }>;
    }
  >();

  for (const ping of pings) {
    const key = ping.userId;
    if (!byUser.has(key)) {
      byUser.set(key, {
        user: {
          id: ping.recorder.id,
          name: ping.recorder.name,
          role: ping.recorder.role,
        },
        latestPingAt: ping.pingAt.toISOString(),
        latest: {
          latitude: Number(ping.latitude),
          longitude: Number(ping.longitude),
          accuracyMeters: ping.accuracyMeters ? Number(ping.accuracyMeters) : null,
          speedKmph: ping.speedKmph ? Number(ping.speedKmph) : null,
          headingDegrees: ping.headingDegrees ? Number(ping.headingDegrees) : null,
          routeId: ping.routeId ?? null,
          routeName: ping.route?.name ?? null,
          deliverySession: ping.deliverySession ?? null,
        },
        trail: [],
      });
    }

    const existing = byUser.get(key)!;
    if (existing.trail.length < 40) {
      existing.trail.push({
        latitude: Number(ping.latitude),
        longitude: Number(ping.longitude),
        pingAt: ping.pingAt.toISOString(),
      });
    }
  }

  return {
    generatedAt: now.toISOString(),
    minutesWindow: clampedMinutes,
    activeVehicles: byUser.size,
    vehicles: Array.from(byUser.values()).sort((a, b) => a.user.name.localeCompare(b.user.name)),
    trackingReady: true,
  };
}
