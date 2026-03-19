import { prisma } from '../../index.js';
import { NotFoundError, ConflictError } from '../../lib/errors.js';
import type { PaginationParams } from '../../lib/pagination.js';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  ChangeStatusInput,
  CustomerQuery,
  CreateAddressInput,
  UpdateAddressInput,
} from './customers.types.js';
import type { Prisma } from '@prisma/client';

// Shared select/include for consistent response shape
const customerInclude = {
  addresses: true,
  route: { select: { id: true, name: true } },
} satisfies Prisma.CustomerInclude;

// ---------------------------------------------------------------------------
// List customers (paginated, filterable, searchable, sortable)
// ---------------------------------------------------------------------------
export async function listCustomers(
  query: CustomerQuery,
  pagination: PaginationParams,
) {
  const where: Prisma.CustomerWhereInput = {};

  // Filter by status
  if (query.status) {
    where.status = query.status;
  }

  // Filter by route
  if (query.routeId) {
    where.routeId = query.routeId;
  }

  // Search across name, phone, address
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      {
        addresses: {
          some: {
            addressLine1: { contains: query.search, mode: 'insensitive' },
          },
        },
      },
    ];
  }

  // Sorting
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';
  const orderBy: Prisma.CustomerOrderByWithRelationInput = { [sortBy]: sortOrder };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy,
      include: customerInclude,
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total };
}

// ---------------------------------------------------------------------------
// Get single customer
// ---------------------------------------------------------------------------
export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: customerInclude,
  });

  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  return customer;
}

// ---------------------------------------------------------------------------
// Create customer
// ---------------------------------------------------------------------------
export async function createCustomer(input: CreateCustomerInput) {
  // Check unique phone
  const existing = await prisma.customer.findUnique({
    where: { phone: input.phone },
  });
  if (existing) {
    throw new ConflictError('A customer with this phone number already exists');
  }

  if (input.pricingCategory) {
    const pricingCategory = await prisma.pricingCategory.findFirst({
      where: { code: input.pricingCategory, isActive: true },
    });
    if (!pricingCategory) {
      throw new ConflictError('Selected pricing category does not exist');
    }
  }

  const { address, ...customerData } = input;

  const customer = await prisma.customer.create({
    data: {
      ...customerData,
      ...(address
        ? {
            addresses: {
              create: { ...address, isPrimary: true },
            },
          }
        : {}),
    },
    include: customerInclude,
  });

  return customer;
}

// ---------------------------------------------------------------------------
// Update customer
// ---------------------------------------------------------------------------
export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Customer not found');
  }

  // If phone is being changed, check uniqueness
  if (input.phone && input.phone !== existing.phone) {
    const phoneExists = await prisma.customer.findUnique({
      where: { phone: input.phone },
    });
    if (phoneExists) {
      throw new ConflictError('A customer with this phone number already exists');
    }
  }

  if (input.pricingCategory) {
    const pricingCategory = await prisma.pricingCategory.findFirst({
      where: { code: input.pricingCategory, isActive: true },
    });
    if (!pricingCategory) {
      throw new ConflictError('Selected pricing category does not exist');
    }
  }

  return prisma.customer.update({
    where: { id },
    data: input,
    include: customerInclude,
  });
}

// ---------------------------------------------------------------------------
// Change customer status
// ---------------------------------------------------------------------------
export async function changeCustomerStatus(id: string, input: ChangeStatusInput, userId?: string) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Customer not found');
  }

  const newStatus = input.status;

  return prisma.$transaction(async (tx) => {
    // Update the customer status
    const customer = await tx.customer.update({
      where: { id },
      data: { status: newStatus },
      include: customerInclude,
    });

    if (newStatus === 'paused') {
      // Suspend all active subscriptions
      const activeSubscriptions = await tx.subscription.findMany({
        where: { customerId: id, status: 'active' },
      });

      if (activeSubscriptions.length > 0) {
        await tx.subscription.updateMany({
          where: { customerId: id, status: 'active' },
          data: { status: 'paused' },
        });

        // Record subscription changes
        if (userId) {
          await tx.subscriptionChange.createMany({
            data: activeSubscriptions.map((sub) => ({
              subscriptionId: sub.id,
              changeType: 'paused',
              oldValue: 'active',
              newValue: 'paused',
              changedBy: userId,
            })),
          });
        }
      }
    } else if (newStatus === 'stopped') {
      // Cancel all active and paused subscriptions
      const subscriptionsToCancel = await tx.subscription.findMany({
        where: { customerId: id, status: { in: ['active', 'paused'] } },
      });

      if (subscriptionsToCancel.length > 0) {
        const today = new Date();
        await tx.subscription.updateMany({
          where: { customerId: id, status: { in: ['active', 'paused'] } },
          data: { status: 'cancelled', endDate: today },
        });

        // Record subscription changes
        if (userId) {
          await tx.subscriptionChange.createMany({
            data: subscriptionsToCancel.map((sub) => ({
              subscriptionId: sub.id,
              changeType: 'cancelled',
              oldValue: sub.status,
              newValue: 'cancelled',
              changedBy: userId,
            })),
          });
        }
      }
    } else if (newStatus === 'active' && existing.status === 'paused') {
      // Resume previously suspended subscriptions (paused ones without an end_date)
      const pausedSubscriptions = await tx.subscription.findMany({
        where: { customerId: id, status: 'paused', endDate: null },
      });

      if (pausedSubscriptions.length > 0) {
        await tx.subscription.updateMany({
          where: { customerId: id, status: 'paused', endDate: null },
          data: { status: 'active' },
        });

        // Record subscription changes
        if (userId) {
          await tx.subscriptionChange.createMany({
            data: pausedSubscriptions.map((sub) => ({
              subscriptionId: sub.id,
              changeType: 'resumed',
              oldValue: 'paused',
              newValue: 'active',
              changedBy: userId,
            })),
          });
        }
      }
    }

    return customer;
  });
}

// ---------------------------------------------------------------------------
// Address management
// ---------------------------------------------------------------------------
export async function listAddresses(customerId: string) {
  // Verify customer exists
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  return prisma.customerAddress.findMany({
    where: { customerId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function createAddress(customerId: string, input: CreateAddressInput) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  // If setting as primary, unset other primary addresses first
  if (input.isPrimary) {
    await prisma.customerAddress.updateMany({
      where: { customerId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  return prisma.customerAddress.create({
    data: { customerId, ...input },
  });
}

export async function updateAddress(
  customerId: string,
  addressId: string,
  input: UpdateAddressInput,
) {
  const address = await prisma.customerAddress.findFirst({
    where: { id: addressId, customerId },
  });
  if (!address) {
    throw new NotFoundError('Address not found');
  }

  // If setting as primary, unset other primary addresses first
  if (input.isPrimary) {
    await prisma.customerAddress.updateMany({
      where: { customerId, isPrimary: true, id: { not: addressId } },
      data: { isPrimary: false },
    });
  }

  return prisma.customerAddress.update({
    where: { id: addressId },
    data: input,
  });
}

// ---------------------------------------------------------------------------
// Reset operational customer data
// ---------------------------------------------------------------------------
export async function resetOperationalCustomerData() {
  return prisma.$transaction(async (tx) => {
    const [
      invoiceLineItems,
      invoiceAdjustments,
      invoiceDiscounts,
      payments,
      invoices,
      ledgerEntries,
      deliveryOrderPacks,
      deliveryOrders,
      subscriptionPacks,
      quantityChanges,
      vacationHolds,
      subscriptionChanges,
      subscriptions,
      routeCustomers,
      addresses,
      customers,
    ] = await Promise.all([
      tx.invoiceLineItem.deleteMany({}),
      tx.invoiceAdjustment.deleteMany({}),
      tx.invoiceDiscount.deleteMany({}),
      tx.payment.deleteMany({}),
      tx.invoice.deleteMany({}),
      tx.ledgerEntry.deleteMany({}),
      tx.deliveryOrderPack.deleteMany({}),
      tx.deliveryOrder.deleteMany({}),
      tx.subscriptionPack.deleteMany({}),
      tx.quantityChange.deleteMany({}),
      tx.vacationHold.deleteMany({}),
      tx.subscriptionChange.deleteMany({}),
      tx.subscription.deleteMany({}),
      tx.routeCustomer.deleteMany({}),
      tx.customerAddress.deleteMany({}),
      tx.customer.deleteMany({}),
    ]);

    return {
      invoiceLineItems: invoiceLineItems.count,
      invoiceAdjustments: invoiceAdjustments.count,
      invoiceDiscounts: invoiceDiscounts.count,
      payments: payments.count,
      invoices: invoices.count,
      ledgerEntries: ledgerEntries.count,
      deliveryOrderPacks: deliveryOrderPacks.count,
      deliveryOrders: deliveryOrders.count,
      subscriptionPacks: subscriptionPacks.count,
      quantityChanges: quantityChanges.count,
      vacationHolds: vacationHolds.count,
      subscriptionChanges: subscriptionChanges.count,
      subscriptions: subscriptions.count,
      routeCustomers: routeCustomers.count,
      addresses: addresses.count,
      customers: customers.count,
    };
  });
}
