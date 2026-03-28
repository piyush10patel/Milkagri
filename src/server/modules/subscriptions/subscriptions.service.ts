import { prisma } from '../../index.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { assertPackBreakdownMatchesQuantity } from '../../lib/packaging.js';
import type { PaginationParams } from '../../lib/pagination.js';
import type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  CancelSubscriptionInput,
  CreateVacationHoldInput,
  ScheduleQuantityChangeInput,
  SubscriptionQuery,
} from './subscriptions.types.js';
import type { Prisma } from '@prisma/client';

const subscriptionInclude = {
  customer: { select: { id: true, name: true, phone: true, status: true } },
  parentSubscription: {
    select: {
      id: true,
      customer: { select: { id: true, name: true } },
    },
  },
  route: { select: { id: true, name: true } },
  productVariant: {
    select: {
      id: true,
      unitType: true,
      quantityPerUnit: true,
      sku: true,
      product: { select: { id: true, name: true } },
    },
  },
  packs: {
    select: {
      id: true,
      packSize: true,
      packCount: true,
    },
    orderBy: { packSize: 'desc' },
  },
} satisfies Prisma.SubscriptionInclude;

// ---------------------------------------------------------------------------
// List subscriptions
// ---------------------------------------------------------------------------
export async function listSubscriptions(
  query: SubscriptionQuery,
  pagination: PaginationParams,
) {
  const where: Prisma.SubscriptionWhereInput = {};

  if (query.customerId) where.customerId = query.customerId;
  if (query.productVariantId) where.productVariantId = query.productVariantId;
  if (query.status) where.status = query.status;

  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';
  const orderBy: Prisma.SubscriptionOrderByWithRelationInput = { [sortBy]: sortOrder };

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy,
      include: subscriptionInclude,
    }),
    prisma.subscription.count({ where }),
  ]);

  return { subscriptions, total };
}


// ---------------------------------------------------------------------------
// Get single subscription
// ---------------------------------------------------------------------------
export async function getSubscription(id: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      ...subscriptionInclude,
      vacationHolds: { orderBy: { startDate: 'desc' } },
      quantityChanges: { orderBy: { effectiveDate: 'desc' } },
      changes: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!subscription) {
    throw new NotFoundError('Subscription not found');
  }

  return subscription;
}

// ---------------------------------------------------------------------------
// Create subscription
// ---------------------------------------------------------------------------
export async function createSubscription(input: CreateSubscriptionInput, userId: string) {
  // Validate customer exists and is active
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new NotFoundError('Customer not found');
  if (customer.status !== 'active') {
    throw new ValidationError('Cannot create subscription for non-active customer');
  }

  // Validate product variant exists and is active
  const variant = await prisma.productVariant.findUnique({ where: { id: input.productVariantId } });
  if (!variant) throw new NotFoundError('Product variant not found');
  if (!variant.isActive) {
    throw new ValidationError('Cannot subscribe to an inactive product variant');
  }

  if (input.routeId) {
    const route = await prisma.route.findUnique({ where: { id: input.routeId } });
    if (!route) throw new NotFoundError('Route not found');
    if (!route.isActive) {
      throw new ValidationError('Cannot assign an inactive route to a subscription');
    }
  }

  const subscriptionType = input.subscriptionType ?? 'regular';
  const parentSubscriptionId = input.parentSubscriptionId ?? null;
  if (subscriptionType === 'sub_subscription' && !parentSubscriptionId) {
    throw new ValidationError('Sub-subscription requires a parent subscription');
  }
  if (parentSubscriptionId) {
    const parent = await prisma.subscription.findUnique({
      where: { id: parentSubscriptionId },
      select: { id: true, customerId: true, status: true },
    });
    if (!parent) {
      throw new NotFoundError('Parent subscription not found');
    }
    if (parent.customerId === input.customerId) {
      throw new ValidationError('Parent and child subscription customer must be different');
    }
    if (parent.status !== 'active') {
      throw new ValidationError('Parent subscription must be active');
    }
  }

  // Validate weekdays for custom_weekday
  if (input.frequencyType === 'custom_weekday' && (!input.weekdays || input.weekdays.length === 0)) {
    throw new ValidationError('Custom weekday frequency requires at least one weekday');
  }

  return prisma.$transaction(async (tx) => {
    const packs = assertPackBreakdownMatchesQuantity(input.quantity, input.packBreakdown);

    const subscription = await tx.subscription.create({
      data: {
        customerId: input.customerId,
        productVariantId: input.productVariantId,
        subscriptionType,
        parentSubscriptionId,
        routeId: input.routeId ?? customer.routeId ?? null,
        quantity: input.quantity,
        deliverySession: input.deliverySession,
        frequencyType: input.frequencyType,
        weekdays: input.weekdays || [],
        startDate: new Date(input.startDate),
        packs: packs.length
          ? {
              create: packs.map((pack) => ({
                packSize: pack.packSize,
                packCount: pack.packCount,
              })),
            }
          : undefined,
      },
      include: subscriptionInclude,
    });

    // Record creation in subscription_changes
    await tx.subscriptionChange.create({
      data: {
        subscriptionId: subscription.id,
        changeType: 'created',
        newValue: JSON.stringify({
          quantity: input.quantity,
          subscriptionType,
          parentSubscriptionId,
          routeId: input.routeId ?? customer.routeId ?? null,
          deliverySession: input.deliverySession,
          frequencyType: input.frequencyType,
          weekdays: input.weekdays,
          packBreakdown: packs,
          startDate: input.startDate,
        }),
        changedBy: userId,
      },
    });

    return subscription;
  });
}

// ---------------------------------------------------------------------------
// Update subscription
// ---------------------------------------------------------------------------
export async function updateSubscription(id: string, input: UpdateSubscriptionInput, userId: string) {
  const existing = await prisma.subscription.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Subscription not found');
  if (existing.status === 'cancelled') {
    throw new ValidationError('Cannot update a cancelled subscription');
  }

  // Validate weekdays for custom_weekday
  if (
    (input.frequencyType === 'custom_weekday' || existing.frequencyType === 'custom_weekday') &&
    input.weekdays !== undefined &&
    input.weekdays.length === 0
  ) {
    throw new ValidationError('Custom weekday frequency requires at least one weekday');
  }

  if (input.routeId) {
    const route = await prisma.route.findUnique({ where: { id: input.routeId } });
    if (!route) throw new NotFoundError('Route not found');
    if (!route.isActive) {
      throw new ValidationError('Cannot assign an inactive route to a subscription');
    }
  }

  const nextSubscriptionType = input.subscriptionType ?? existing.subscriptionType;
  const nextParentSubscriptionId = input.parentSubscriptionId === undefined
    ? existing.parentSubscriptionId
    : input.parentSubscriptionId;
  if (nextSubscriptionType === 'sub_subscription' && !nextParentSubscriptionId) {
    throw new ValidationError('Sub-subscription requires a parent subscription');
  }
  if (nextParentSubscriptionId) {
    if (nextParentSubscriptionId === id) {
      throw new ValidationError('Subscription cannot be its own parent');
    }
    const parent = await prisma.subscription.findUnique({
      where: { id: nextParentSubscriptionId },
      select: { id: true, customerId: true, status: true },
    });
    if (!parent) {
      throw new NotFoundError('Parent subscription not found');
    }
    if (parent.customerId === existing.customerId) {
      throw new ValidationError('Parent and child subscription customer must be different');
    }
    if (parent.status !== 'active') {
      throw new ValidationError('Parent subscription must be active');
    }
  }

  return prisma.$transaction(async (tx) => {
    const nextQuantity = input.quantity !== undefined ? input.quantity : Number(existing.quantity);
    const packs = input.packBreakdown !== undefined
      ? assertPackBreakdownMatchesQuantity(nextQuantity, input.packBreakdown)
      : undefined;

    const subscription = await tx.subscription.update({
      where: { id },
      data: {
        ...(input.subscriptionType !== undefined ? { subscriptionType: input.subscriptionType } : {}),
        ...(input.parentSubscriptionId !== undefined ? { parentSubscriptionId: input.parentSubscriptionId } : {}),
        ...(input.routeId !== undefined ? { routeId: input.routeId } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.deliverySession !== undefined ? { deliverySession: input.deliverySession } : {}),
        ...(input.frequencyType !== undefined ? { frequencyType: input.frequencyType } : {}),
        ...(input.weekdays !== undefined ? { weekdays: input.weekdays } : {}),
      },
      include: subscriptionInclude,
    });

    if (packs !== undefined) {
      await tx.subscriptionPack.deleteMany({ where: { subscriptionId: id } });
      if (packs.length) {
        await tx.subscriptionPack.createMany({
          data: packs.map((pack) => ({
            subscriptionId: id,
            packSize: pack.packSize,
            packCount: pack.packCount,
          })),
        });
      }
    }

    const refreshed = await tx.subscription.findUnique({
      where: { id },
      include: subscriptionInclude,
    });

    if (!refreshed) {
      throw new NotFoundError('Subscription not found');
    }

    // Record changes
    const changes: Record<string, { old?: unknown; new?: unknown }> = {};
    if (input.quantity !== undefined && Number(existing.quantity) !== input.quantity) {
      changes.quantity = { old: Number(existing.quantity), new: input.quantity };
    }
    if (input.routeId !== undefined && existing.routeId !== input.routeId) {
      changes.routeId = { old: existing.routeId, new: input.routeId };
    }
    if (input.subscriptionType !== undefined && existing.subscriptionType !== input.subscriptionType) {
      changes.subscriptionType = { old: existing.subscriptionType, new: input.subscriptionType };
    }
    if (input.parentSubscriptionId !== undefined && existing.parentSubscriptionId !== input.parentSubscriptionId) {
      changes.parentSubscriptionId = { old: existing.parentSubscriptionId, new: input.parentSubscriptionId };
    }
    if (input.deliverySession !== undefined && existing.deliverySession !== input.deliverySession) {
      changes.deliverySession = { old: existing.deliverySession, new: input.deliverySession };
    }
    if (input.frequencyType !== undefined && existing.frequencyType !== input.frequencyType) {
      changes.frequencyType = { old: existing.frequencyType, new: input.frequencyType };
    }
    if (input.weekdays !== undefined) {
      changes.weekdays = { old: existing.weekdays, new: input.weekdays };
    }
    if (packs !== undefined) {
      changes.packBreakdown = {
        old: subscription.packs.map((pack) => ({
          packSize: Number(pack.packSize),
          packCount: pack.packCount,
        })),
        new: packs,
      };
    }

    if (Object.keys(changes).length > 0) {
      await tx.subscriptionChange.create({
        data: {
          subscriptionId: id,
          changeType: input.quantity !== undefined ? 'quantity_changed' : 'updated',
          oldValue: JSON.stringify(
            Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])),
          ),
          newValue: JSON.stringify(
            Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])),
          ),
          changedBy: userId,
        },
      });
    }

    return refreshed;
  });
}

// ---------------------------------------------------------------------------
// Cancel subscription
// ---------------------------------------------------------------------------
export async function cancelSubscription(id: string, input: CancelSubscriptionInput, userId: string) {
  const existing = await prisma.subscription.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Subscription not found');
  if (existing.status === 'cancelled') {
    throw new ValidationError('Subscription is already cancelled');
  }

  const endDate = input.endDate ? new Date(input.endDate) : new Date();

  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.update({
      where: { id },
      data: {
        status: 'cancelled',
        endDate,
      },
      include: subscriptionInclude,
    });

    await tx.subscriptionChange.create({
      data: {
        subscriptionId: id,
        changeType: 'cancelled',
        oldValue: existing.status,
        newValue: 'cancelled',
        changedBy: userId,
      },
    });

    return subscription;
  });
}

// ---------------------------------------------------------------------------
// Delete subscription
// ---------------------------------------------------------------------------
export async function deleteSubscription(id: string) {
  const existing = await prisma.subscription.findUnique({
    where: { id },
    include: {
      deliveryOrders: {
        include: {
          invoiceLineItems: {
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('Subscription not found');
  }

  const hasProtectedHistory = existing.deliveryOrders.some(
    (order) => order.status !== 'pending' || order.invoiceLineItems.length > 0,
  );

  if (hasProtectedHistory) {
    throw new ValidationError(
      'This subscription already has delivery or invoice history. Cancel it instead of deleting it.',
    );
  }

  return prisma.$transaction(async (tx) => {
    const orderIds = existing.deliveryOrders.map((order) => order.id);

    if (orderIds.length > 0) {
      await tx.deliveryOrderPack.deleteMany({
        where: { deliveryOrderId: { in: orderIds } },
      });
      await tx.deliveryOrder.deleteMany({
        where: { id: { in: orderIds } },
      });
    }

    await tx.subscription.delete({
      where: { id },
    });

    return { id, removedOrders: orderIds.length };
  });
}

// ---------------------------------------------------------------------------
// Get subscription change history
// ---------------------------------------------------------------------------
export async function getSubscriptionHistory(id: string) {
  const subscription = await prisma.subscription.findUnique({ where: { id } });
  if (!subscription) throw new NotFoundError('Subscription not found');

  return prisma.subscriptionChange.findMany({
    where: { subscriptionId: id },
    orderBy: { createdAt: 'desc' },
    include: {
      changer: { select: { id: true, name: true, email: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Vacation holds
// ---------------------------------------------------------------------------
export async function createVacationHold(
  subscriptionId: string,
  input: CreateVacationHoldInput,
  userId: string,
) {
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) throw new NotFoundError('Subscription not found');
  if (subscription.status !== 'active') {
    throw new ValidationError('Can only create vacation holds on active subscriptions');
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (endDate < startDate) {
    throw new ValidationError('End date must be on or after start date');
  }

  return prisma.$transaction(async (tx) => {
    const hold = await tx.vacationHold.create({
      data: {
        subscriptionId,
        startDate,
        endDate,
        createdBy: userId,
      },
    });

    await tx.subscriptionChange.create({
      data: {
        subscriptionId,
        changeType: 'vacation_hold',
        newValue: JSON.stringify({ startDate: input.startDate, endDate: input.endDate }),
        changedBy: userId,
      },
    });

    return hold;
  });
}

export async function resumeVacationHold(
  subscriptionId: string,
  holdId: string,
  userId: string,
) {
  const hold = await prisma.vacationHold.findFirst({
    where: { id: holdId, subscriptionId },
  });
  if (!hold) throw new NotFoundError('Vacation hold not found');
  if (hold.resumedAt) {
    throw new ValidationError('Vacation hold has already been resumed');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.vacationHold.update({
      where: { id: holdId },
      data: { resumedAt: today },
    });

    await tx.subscriptionChange.create({
      data: {
        subscriptionId,
        changeType: 'vacation_resume',
        oldValue: JSON.stringify({
          startDate: hold.startDate.toISOString().slice(0, 10),
          endDate: hold.endDate.toISOString().slice(0, 10),
        }),
        newValue: JSON.stringify({ resumedAt: today.toISOString().slice(0, 10) }),
        changedBy: userId,
      },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Quantity changes
// ---------------------------------------------------------------------------
export async function scheduleQuantityChange(
  subscriptionId: string,
  input: ScheduleQuantityChangeInput,
  userId: string,
) {
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) throw new NotFoundError('Subscription not found');
  if (subscription.status === 'cancelled') {
    throw new ValidationError('Cannot schedule quantity change on a cancelled subscription');
  }

  const effectiveDate = new Date(input.effectiveDate);

  return prisma.$transaction(async (tx) => {
    const change = await tx.quantityChange.create({
      data: {
        subscriptionId,
        newQuantity: input.newQuantity,
        effectiveDate,
        createdBy: userId,
      },
    });

    await tx.subscriptionChange.create({
      data: {
        subscriptionId,
        changeType: 'quantity_changed',
        oldValue: String(Number(subscription.quantity)),
        newValue: String(input.newQuantity),
        changedBy: userId,
      },
    });

    return change;
  });
}


// ---------------------------------------------------------------------------
// Apply pending quantity changes
// ---------------------------------------------------------------------------
/**
 * Apply all pending quantity changes whose effective_date <= targetDate.
 * Updates the subscription quantity and marks the change as applied.
 * Returns the number of changes applied.
 */
export async function applyPendingQuantityChanges(targetDate: Date): Promise<number> {
  const pending = await prisma.quantityChange.findMany({
    where: {
      applied: false,
      effectiveDate: { lte: targetDate },
    },
    orderBy: { effectiveDate: 'asc' },
  });

  let applied = 0;

  for (const change of pending) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: change.subscriptionId },
        data: { quantity: change.newQuantity },
      });

      await tx.quantityChange.update({
        where: { id: change.id },
        data: { applied: true },
      });
    });

    applied++;
  }

  return applied;
}
