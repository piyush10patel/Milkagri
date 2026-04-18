import { prisma } from '../../index.js';
import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';
import type { PaginationParams } from '../../lib/pagination.js';
import type {
  CreateRouteInput,
  UpdateRouteInput,
  RouteQuery,
  AssignCustomersInput,
  AssignAgentsInput,
  GeneratePathInput,
} from './routes.types.js';
import type { Prisma } from '@prisma/client';
import { generateRoutePath as osrmGenerateRoutePath } from '../../lib/osrm.js';
import {
  serializeWaypoints,
  deserializeWaypoints,
  autoPopulateCustomerStops,
  isPathStale,
} from '../../lib/waypoints.js';
import type { RouteWaypoint } from '../../lib/waypoints.js';

function normalizeStartLocationInput(
  input: Partial<{
    startLocationMode: 'none' | 'existing_stop' | 'custom';
    startCustomerId: string | null;
    startLatitude: number | null;
    startLongitude: number | null;
    startLabel: string | null;
  }>,
) {
  if (input.startLocationMode === undefined) return {};

  if (input.startLocationMode === 'none') {
    return {
      startLocationMode: 'none',
      startCustomerId: null,
      startLatitude: null,
      startLongitude: null,
      startLabel: null,
    };
  }

  if (input.startLocationMode === 'existing_stop') {
    if (!input.startCustomerId) {
      throw new ValidationError('Start customer is required when using existing stop');
    }
    return {
      startLocationMode: 'existing_stop',
      startCustomerId: input.startCustomerId,
      startLatitude: null,
      startLongitude: null,
      startLabel: input.startLabel ?? null,
    };
  }

  if (input.startLocationMode === 'custom') {
    if (input.startLatitude === null || input.startLatitude === undefined || input.startLongitude === null || input.startLongitude === undefined) {
      throw new ValidationError('Start latitude and longitude are required for custom start location');
    }
    return {
      startLocationMode: 'custom',
      startCustomerId: null,
      startLatitude: input.startLatitude,
      startLongitude: input.startLongitude,
      startLabel: input.startLabel ?? null,
    };
  }

  return {};
}

// Shared include for consistent response shape
const routeInclude = {
  routeCustomers: {
    include: { customer: { select: { id: true, name: true, phone: true, status: true } } },
    orderBy: { sequenceOrder: 'asc' as const },
  },
  routeAgents: {
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  },
} satisfies Prisma.RouteInclude;

// ---------------------------------------------------------------------------
// List routes (paginated, filterable, searchable)
// ---------------------------------------------------------------------------
export async function listRoutes(query: RouteQuery, pagination: PaginationParams) {
  const where: Prisma.RouteWhereInput = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive === 'true';
  }

  if (query.routeType) {
    where.routeType = query.routeType;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';
  const orderBy: Prisma.RouteOrderByWithRelationInput = { [sortBy]: sortOrder };

  const [routes, total] = await Promise.all([
    prisma.route.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy,
      include: routeInclude,
    }),
    prisma.route.count({ where }),
  ]);

  return { routes, total };
}

// ---------------------------------------------------------------------------
// Get single route
// ---------------------------------------------------------------------------
export async function getRoute(id: string) {
  const route = await prisma.route.findUnique({
    where: { id },
    include: routeInclude,
  });

  if (!route) {
    throw new NotFoundError('Route not found');
  }

  return route;
}

// ---------------------------------------------------------------------------
// Create route
// ---------------------------------------------------------------------------
export async function createRoute(input: CreateRouteInput) {
  const startLocation = normalizeStartLocationInput(input as any);
  return prisma.route.create({
    data: { ...input, ...startLocation },
    include: routeInclude,
  });
}

// ---------------------------------------------------------------------------
// Update route
// ---------------------------------------------------------------------------
export async function updateRoute(id: string, input: UpdateRouteInput) {
  const existing = await prisma.route.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Route not found');
  }

  const startLocation = normalizeStartLocationInput(input as any);
  return prisma.route.update({
    where: { id },
    data: { ...input, ...startLocation },
    include: routeInclude,
  });
}

// ---------------------------------------------------------------------------
// Delete route
// ---------------------------------------------------------------------------
export async function deleteRoute(id: string) {
  const route = await prisma.route.findUnique({
    where: { id },
    include: {
      routeCustomers: true,
      deliveryOrders: {
        select: { id: true },
        take: 1,
      },
      routeHolidays: {
        select: { id: true },
      },
      routeAgents: {
        select: { id: true },
      },
    },
  });

  if (!route) {
    throw new NotFoundError('Route not found');
  }

  if (route.routeCustomers.length > 0) {
    throw new ValidationError(
      'Cannot delete route with assigned customers. Reassign or remove those customers first.',
      { customers: [`${route.routeCustomers.length} customer(s) still assigned`] },
    );
  }

  if (route.deliveryOrders.length > 0) {
    throw new ValidationError(
      'Cannot delete route with delivery order history. Deactivate it instead.',
    );
  }

  await prisma.route.delete({
    where: { id },
  });

  return {
    id,
    removedAgents: route.routeAgents.length,
    removedHolidays: route.routeHolidays.length,
  };
}


// ---------------------------------------------------------------------------
// Deactivate route — requires all customers to be reassigned first (Req 8.7)
// ---------------------------------------------------------------------------
export async function deactivateRoute(id: string) {
  const route = await prisma.route.findUnique({
    where: { id },
    include: { routeCustomers: true },
  });

  if (!route) {
    throw new NotFoundError('Route not found');
  }

  if (!route.isActive) {
    throw new ConflictError('Route is already inactive');
  }

  // Block deactivation if customers are still assigned
  if (route.routeCustomers.length > 0) {
    throw new ValidationError(
      'Cannot deactivate route with assigned customers. Reassign all customers to other routes first.',
      { customers: [`${route.routeCustomers.length} customer(s) still assigned`] },
    );
  }

  return prisma.route.update({
    where: { id },
    data: { isActive: false },
    include: routeInclude,
  });
}

// ---------------------------------------------------------------------------
// Assign / reorder customers on a route (Req 8.2, 8.4, 8.5)
// Full replacement: removes existing assignments and creates new ones.
// When a customer moves to a different route, future delivery_orders are updated.
// ---------------------------------------------------------------------------
export async function assignCustomers(routeId: string, input: AssignCustomersInput) {
  const route = await prisma.route.findUnique({ where: { id: routeId } });
  if (!route) {
    throw new NotFoundError('Route not found');
  }

  // Validate no duplicate customers
  const customerIds = input.customers.map((c) => c.customerId);
  if (new Set(customerIds).size !== customerIds.length) {
    throw new ValidationError('Duplicate customer IDs in assignment list', {
      customers: ['Each customer can only appear once'],
    });
  }

  // Validate no duplicate sequence orders
  const sequences = input.customers.map((c) => c.sequenceOrder);
  if (new Set(sequences).size !== sequences.length) {
    throw new ValidationError('Duplicate sequence orders in assignment list', {
      sequenceOrder: ['Each sequence order must be unique'],
    });
  }

  for (const customer of input.customers) {
    const hasLat = customer.dropLatitude !== undefined;
    const hasLon = customer.dropLongitude !== undefined;
    if (hasLat !== hasLon) {
      throw new ValidationError('Drop location requires both latitude and longitude', {
        dropLocation: ['Provide both dropLatitude and dropLongitude for each stop'],
      });
    }
  }

  // Validate all customers exist
  if (customerIds.length > 0) {
    const existingCustomers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingCustomers.map((c) => c.id));
    const missing = customerIds.filter((cid) => !existingIds.has(cid));
    if (missing.length > 0) {
      throw new NotFoundError(`Customer(s) not found: ${missing.join(', ')}`);
    }
  }

  return prisma.$transaction(async (tx) => {
    // Get current assignments to detect customers moving between routes
    const previousAssignments = await tx.routeCustomer.findMany({
      where: { routeId },
      select: { customerId: true },
    });
    const previousCustomerIds = new Set(previousAssignments.map((a) => a.customerId));

  // Remove all existing assignments for this route
  await tx.routeCustomer.deleteMany({ where: { routeId } });

    // Create new assignments
    if (input.customers.length > 0) {
      await tx.routeCustomer.createMany({
        data: input.customers.map((c) => ({
          routeId,
          customerId: c.customerId,
          sequenceOrder: c.sequenceOrder,
          plannedDropQuantity: c.plannedDropQuantity ?? null,
          dropLatitude: c.dropLatitude ?? null,
          dropLongitude: c.dropLongitude ?? null,
        })),
      });
    }

    // Update customer.routeId for all assigned customers
    if (customerIds.length > 0) {
      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: { routeId },
      });
    }

    // Update future delivery_orders for customers assigned to this route (Req 8.5)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (customerIds.length > 0) {
      await tx.deliveryOrder.updateMany({
        where: {
          customerId: { in: customerIds },
          deliveryDate: { gt: today },
          status: 'pending',
        },
        data: { routeId },
      });
    }

    // Fetch and return updated route
    return tx.route.findUnique({
      where: { id: routeId },
      include: routeInclude,
    });
  });
}

// ---------------------------------------------------------------------------
// Assign agents to a route (Req 8.3)
// Full replacement of agent list.
// ---------------------------------------------------------------------------
export async function assignAgents(routeId: string, input: { agentIds: string[] }) {
  const route = await prisma.route.findUnique({ where: { id: routeId } });
  if (!route) {
    throw new NotFoundError('Route not found');
  }

  // Validate all agents exist and have delivery_agent role
  if (input.agentIds.length > 0) {
    const agents = await prisma.user.findMany({
      where: { id: { in: input.agentIds }, isActive: true },
      select: { id: true, role: true },
    });
    const agentMap = new Map(agents.map((a) => [a.id, a.role]));

    for (const agentId of input.agentIds) {
      if (!agentMap.has(agentId)) {
        throw new NotFoundError(`Agent not found or inactive: ${agentId}`);
      }
      if (agentMap.get(agentId) !== 'delivery_agent') {
        throw new ValidationError('Only delivery agents can be assigned to routes', {
          agentIds: [`User ${agentId} is not a delivery agent`],
        });
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    // Remove existing agent assignments
    await tx.routeAgent.deleteMany({ where: { routeId } });

    // Create new assignments
    if (input.agentIds.length > 0) {
      await tx.routeAgent.createMany({
        data: input.agentIds.map((userId) => ({ routeId, userId })),
      });
    }

    return tx.route.findUnique({
      where: { id: routeId },
      include: routeInclude,
    });
  });
}

// ---------------------------------------------------------------------------
// Route summary stats (Req 8.8)
// ---------------------------------------------------------------------------
export async function getRouteSummary(routeId: string) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      routeCustomers: true,
      routeAgents: true,
    },
  });

  if (!route) {
    throw new NotFoundError('Route not found');
  }

  // Get today's delivery quantities grouped by product variant
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyQuantities = await prisma.deliveryOrder.groupBy({
    by: ['productVariantId'],
    where: {
      routeId,
      deliveryDate: today,
      status: { in: ['pending', 'delivered'] },
    },
    _sum: { quantity: true },
    _count: true,
  });

  // Fetch variant details for the grouped results
  const variantIds = dailyQuantities.map((dq) => dq.productVariantId);
  const variants = variantIds.length > 0
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: { select: { name: true } } },
      })
    : [];
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const dailyDeliveryByVariant = dailyQuantities.map((dq) => {
    const variant = variantMap.get(dq.productVariantId);
    return {
      productVariantId: dq.productVariantId,
      productName: variant?.product?.name ?? 'Unknown',
      unitType: variant?.unitType ?? 'Unknown',
      quantityPerUnit: variant?.quantityPerUnit ?? 0,
      totalQuantity: dq._sum.quantity,
      orderCount: dq._count,
    };
  });

  return {
    routeId: route.id,
    routeName: route.name,
    isActive: route.isActive,
    customerCount: route.routeCustomers.length,
    agentCount: route.routeAgents.length,
    dailyDeliveryByVariant,
  };
}

// ---------------------------------------------------------------------------
// Route manifest for a date (Req 8.6)
// Lists delivery orders in sequence order with customer name, address,
// delivery notes, products, and quantities.
// ---------------------------------------------------------------------------
export async function getRouteManifest(routeId: string, date: string) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    select: { id: true, name: true, description: true, isActive: true },
  });

  if (!route) {
    throw new NotFoundError('Route not found');
  }

  // Get customers in sequence order with their primary address
  const routeCustomers = await prisma.routeCustomer.findMany({
    where: { routeId },
    orderBy: { sequenceOrder: 'asc' },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          deliveryNotes: true,
          addresses: {
            where: { isPrimary: true },
            take: 1,
          },
        },
      },
    },
  });

  // Get delivery orders for this route and date
  const deliveryDate = new Date(date + 'T00:00:00.000Z');
  const deliveryOrders = await prisma.deliveryOrder.findMany({
    where: {
      routeId,
      deliveryDate,
    },
    include: {
      productVariant: {
        include: {
          product: { select: { name: true } },
        },
      },
    },
  });

  // Group delivery orders by customer
  const ordersByCustomer = new Map<string, typeof deliveryOrders>();
  for (const order of deliveryOrders) {
    const existing = ordersByCustomer.get(order.customerId) ?? [];
    existing.push(order);
    ordersByCustomer.set(order.customerId, existing);
  }

  // Build manifest entries in sequence order
  const stops = routeCustomers.map((rc) => {
    const customer = rc.customer;
    const primaryAddress = customer.addresses[0] ?? null;
    const orders = ordersByCustomer.get(customer.id) ?? [];

    return {
      sequenceOrder: rc.sequenceOrder,
      plannedDropQuantity: rc.plannedDropQuantity !== null ? Number(rc.plannedDropQuantity) : null,
      dropLocation:
        rc.dropLatitude !== null && rc.dropLongitude !== null
          ? {
              latitude: Number(rc.dropLatitude),
              longitude: Number(rc.dropLongitude),
            }
          : null,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        deliveryNotes: customer.deliveryNotes,
        address: primaryAddress
          ? {
              addressLine1: primaryAddress.addressLine1,
              addressLine2: primaryAddress.addressLine2,
              city: primaryAddress.city,
              state: primaryAddress.state,
              pincode: primaryAddress.pincode,
            }
          : null,
      },
      products: orders.map((o) => ({
        deliveryOrderId: o.id,
        productName: o.productVariant.product.name,
        unitType: o.productVariant.unitType,
        quantityPerUnit: o.productVariant.quantityPerUnit,
        quantity: o.quantity,
        status: o.status,
      })),
    };
  });

  return {
    routeId: route.id,
    routeName: route.name,
    date,
    totalStops: stops.length,
    totalOrders: deliveryOrders.length,
    stops,
  };
}

// ---------------------------------------------------------------------------
// Printable manifest HTML (Req 8.6, 19.2)
// Returns simplified HTML suitable for printing.
// ---------------------------------------------------------------------------
export async function getRouteManifestPrintHtml(routeId: string, date: string): Promise<string> {
  const manifest = await getRouteManifest(routeId, date);

  const stopRows = manifest.stops
    .map((stop) => {
      const addr = stop.customer.address;
      const addressStr = addr
        ? [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pincode]
            .filter(Boolean)
            .join(', ')
        : 'No address';

      const productRows = stop.products
        .map(
          (p) =>
            `<tr><td>${escapeHtml(p.productName)}</td><td>${p.quantityPerUnit} ${p.unitType}</td><td>${p.quantity}</td><td>${p.status}</td></tr>`,
        )
        .join('');

      const productTable =
        stop.products.length > 0
          ? `<table class="products"><thead><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Status</th></tr></thead><tbody>${productRows}</tbody></table>`
          : '<p class="no-orders">No orders</p>';

      return `
        <div class="stop">
          <div class="stop-header">
            <span class="seq">#${stop.sequenceOrder}</span>
            <strong>${escapeHtml(stop.customer.name)}</strong>
            <span class="phone">${escapeHtml(stop.customer.phone)}</span>
          </div>
          <div class="address">${escapeHtml(addressStr)}</div>
          ${stop.customer.deliveryNotes ? `<div class="notes">Notes: ${escapeHtml(stop.customer.deliveryNotes)}</div>` : ''}
          ${productTable}
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Route Manifest – ${escapeHtml(manifest.routeName)} – ${escapeHtml(manifest.date)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 16px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { color: #555; margin-bottom: 16px; }
    .stop { border: 1px solid #ccc; padding: 8px; margin-bottom: 8px; page-break-inside: avoid; }
    .stop-header { font-size: 13px; margin-bottom: 4px; }
    .seq { display: inline-block; width: 28px; font-weight: bold; }
    .phone { color: #666; margin-left: 8px; }
    .address { color: #444; margin-bottom: 4px; font-size: 11px; }
    .notes { color: #888; font-style: italic; margin-bottom: 4px; font-size: 11px; }
    .products { width: 100%; border-collapse: collapse; font-size: 11px; }
    .products th, .products td { border: 1px solid #ddd; padding: 3px 6px; text-align: left; }
    .products th { background: #f5f5f5; }
    .no-orders { color: #999; font-size: 11px; }
    @media print { body { padding: 0; } .stop { border: 1px solid #000; } }
  </style>
</head>
<body>
  <h1>Route Manifest: ${escapeHtml(manifest.routeName)}</h1>
  <div class="meta">Date: ${escapeHtml(manifest.date)} | Stops: ${manifest.totalStops} | Orders: ${manifest.totalOrders}</div>
  ${stopRows}
</body>
</html>`;
}

/** Minimal HTML escaping for safe output. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// ---------------------------------------------------------------------------
// Generate route path via OSRM (Req 2.1, 3.1–3.4)
// ---------------------------------------------------------------------------
export async function generateRoutePath(routeId: string, input: GeneratePathInput) {
  const route = await prisma.route.findUnique({ where: { id: routeId } });
  if (!route) {
    throw new NotFoundError('Route not found');
  }

  // Map waypoints to OSRM format and call the OSRM service
  const osrmWaypoints = input.waypoints.map((wp) => ({
    latitude: wp.latitude,
    longitude: wp.longitude,
  }));

  const result = await osrmGenerateRoutePath(osrmWaypoints);

  // Persist path data on the Route record
  const updatedRoute = await prisma.route.update({
    where: { id: routeId },
    data: {
      routePath: result.polyline,
      routeWaypoints: JSON.parse(serializeWaypoints(input.waypoints)),
      routeDistanceMeters: result.distanceMeters,
      routeDurationSeconds: result.durationSeconds,
      routePathGeneratedAt: new Date(),
    },
    include: routeInclude,
  });

  return {
    polyline: result.polyline,
    distanceMeters: result.distanceMeters,
    durationSeconds: result.durationSeconds,
    waypoints: input.waypoints,
    generatedAt: updatedRoute.routePathGeneratedAt,
  };
}

// ---------------------------------------------------------------------------
// Get stored route path with staleness flag (Req 3.5)
// ---------------------------------------------------------------------------
export async function getRoutePath(routeId: string) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      routeCustomers: {
        orderBy: { sequenceOrder: 'asc' as const },
      },
    },
  });

  if (!route) {
    throw new NotFoundError('Route not found');
  }

  // No path generated yet
  if (!route.routePath) {
    return null;
  }

  // Deserialize stored waypoints
  const storedWaypoints = deserializeWaypoints(
    typeof route.routeWaypoints === 'string'
      ? route.routeWaypoints
      : JSON.stringify(route.routeWaypoints),
  );

  // Auto-populate current customer stops from routeCustomers
  const currentCustomerStops = autoPopulateCustomerStops(
    route.routeCustomers
      .filter((rc) => rc.dropLatitude !== null && rc.dropLongitude !== null)
      .map((rc) => ({
        id: rc.id,
        dropLatitude: Number(rc.dropLatitude),
        dropLongitude: Number(rc.dropLongitude),
        sequenceOrder: rc.sequenceOrder,
      })),
  );

  // Compute staleness
  const isStale = isPathStale(storedWaypoints, currentCustomerStops);

  return {
    polyline: route.routePath,
    waypoints: storedWaypoints,
    distanceMeters: route.routeDistanceMeters,
    durationSeconds: route.routeDurationSeconds,
    generatedAt: route.routePathGeneratedAt,
    isStale,
  };
}
