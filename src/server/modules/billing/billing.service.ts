import { prisma } from '../../index.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { getEffectivePrice } from '../../lib/pricing.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { Prisma } from '@prisma/client';
import type { ListInvoicesQuery, AddAdjustmentInput, AddDiscountInput } from './billing.types.js';
import { createLedgerEntry } from '../ledger/ledger.service.js';
import { getNextCycle, getCycleForDate, isCycleComplete } from '../../lib/billingCycle.js';

// ---------------------------------------------------------------------------
// Generate invoices for a billing cycle (Req 9.1, 9.2, 9.3, 9.4, 9.7, 9.8)
// ---------------------------------------------------------------------------
export async function generateInvoicesForCycle(cycleStart: string, cycleEnd: string) {
  const cycleStartDate = new Date(cycleStart + 'T00:00:00.000Z');
  const cycleEndDate = new Date(cycleEnd + 'T00:00:00.000Z');

  if (cycleStartDate >= cycleEndDate) {
    throw new ValidationError('cycleStart must be before cycleEnd', {
      cycleStart: ['Must be before cycleEnd'],
    });
  }

  // Find all customers with delivered orders in this cycle
  const deliveredOrders = await prisma.deliveryOrder.findMany({
    where: {
      status: 'delivered',
      deliveryDate: { gte: cycleStartDate, lte: cycleEndDate },
    },
    include: {
      productVariant: true,
    },
    orderBy: [{ customerId: 'asc' }, { deliveryDate: 'asc' }],
  });

  // Group orders by customer
  const ordersByCustomer = new Map<string, typeof deliveredOrders>();
  for (const order of deliveredOrders) {
    const list = ordersByCustomer.get(order.customerId) ?? [];
    list.push(order);
    ordersByCustomer.set(order.customerId, list);
  }

  const invoicesCreated: string[] = [];

  for (const [customerId, orders] of ordersByCustomer) {
    // Get previous invoice closing balance as opening balance (Req 9.7)
    const previousInvoice = await prisma.invoice.findFirst({
      where: { customerId, isCurrent: true },
      orderBy: { billingCycleEnd: 'desc' },
    });

    // Only use previous balance if it's from a prior cycle
    let openingBalance = new Prisma.Decimal(0);
    if (previousInvoice && previousInvoice.billingCycleEnd < cycleStartDate) {
      openingBalance = previousInvoice.closingBalance;
    }

    // Calculate line items (Req 9.3, 9.4)
    const lineItems: {
      deliveryOrderId: string;
      productVariantId: string;
      deliveryDate: Date;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }[] = [];

    let totalCharges = new Prisma.Decimal(0);

    for (const order of orders) {
      const priceRecord = await getEffectivePrice(
        order.productVariantId,
        order.deliveryDate,
      );

      const qty = new Prisma.Decimal(order.quantity.toString());
      const unitPrice = new Prisma.Decimal(priceRecord.price.toString());
      const lineTotal = qty.mul(unitPrice);

      lineItems.push({
        deliveryOrderId: order.id,
        productVariantId: order.productVariantId,
        deliveryDate: order.deliveryDate,
        quantity: qty,
        unitPrice,
        lineTotal,
      });

      totalCharges = totalCharges.add(lineTotal);
    }

    // Calculate closing balance (Req 9.8)
    // closing = opening + charges - discounts + adjustments - payments
    // For new invoices, discounts/adjustments/payments start at 0
    const totalDiscounts = new Prisma.Decimal(0);
    const totalAdjustments = new Prisma.Decimal(0);
    const totalPayments = new Prisma.Decimal(0);
    const closingBalance = openingBalance
      .add(totalCharges)
      .sub(totalDiscounts)
      .add(totalAdjustments)
      .sub(totalPayments);

    // Determine payment status (Req 9.10)
    const paymentStatus = closingBalance.lte(0) ? 'paid' : 'unpaid';

    // Create invoice with line items in a transaction
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          customerId,
          billingCycleStart: cycleStartDate,
          billingCycleEnd: cycleEndDate,
          version: 1,
          openingBalance,
          totalCharges,
          totalDiscounts,
          totalAdjustments,
          totalPayments,
          closingBalance,
          paymentStatus,
          isCurrent: true,
          generatedAt: new Date(),
        },
      });

      if (lineItems.length > 0) {
        await tx.invoiceLineItem.createMany({
          data: lineItems.map((li) => ({
            invoiceId: inv.id,
            deliveryOrderId: li.deliveryOrderId,
            productVariantId: li.productVariantId,
            deliveryDate: li.deliveryDate,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            lineTotal: li.lineTotal,
          })),
        });
      }

      // Create ledger entry for the invoice charge (Req 21.1)
      if (totalCharges.gt(0)) {
        await createLedgerEntry(tx, {
          customerId,
          entryDate: cycleEndDate,
          transactionType: 'charge',
          referenceType: 'invoice',
          referenceId: inv.id,
          debitAmount: totalCharges,
          creditAmount: new Prisma.Decimal(0),
          description: `Invoice charges for ${cycleStart} to ${cycleEnd}`,
        });
      }

      return inv;
    });

    invoicesCreated.push(invoice.id);
  }

  return {
    invoicesCreated: invoicesCreated.length,
    invoiceIds: invoicesCreated,
    cycleStart,
    cycleEnd,
  };
}

// ---------------------------------------------------------------------------
// Regenerate invoice (Req 9.12)
// Increment version, mark old as is_current=false, create new invoice
// ---------------------------------------------------------------------------
export async function regenerateInvoice(invoiceId: string) {
  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true },
  });

  if (!existing) throw new NotFoundError('Invoice not found');
  if (!existing.isCurrent) {
    throw new ValidationError('Cannot regenerate a superseded invoice', {
      id: ['Invoice is not the current version'],
    });
  }

  const cycleStart = existing.billingCycleStart;
  const cycleEnd = existing.billingCycleEnd;

  // Get delivered orders for this customer in the cycle
  const deliveredOrders = await prisma.deliveryOrder.findMany({
    where: {
      customerId: existing.customerId,
      status: 'delivered',
      deliveryDate: { gte: cycleStart, lte: cycleEnd },
    },
    include: { productVariant: true },
    orderBy: { deliveryDate: 'asc' },
  });

  // Recalculate line items
  const lineItems: {
    deliveryOrderId: string;
    productVariantId: string;
    deliveryDate: Date;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }[] = [];

  let totalCharges = new Prisma.Decimal(0);

  for (const order of deliveredOrders) {
    const priceRecord = await getEffectivePrice(
      order.productVariantId,
      order.deliveryDate,
    );

    const qty = new Prisma.Decimal(order.quantity.toString());
    const unitPrice = new Prisma.Decimal(priceRecord.price.toString());
    const lineTotal = qty.mul(unitPrice);

    lineItems.push({
      deliveryOrderId: order.id,
      productVariantId: order.productVariantId,
      deliveryDate: order.deliveryDate,
      quantity: qty,
      unitPrice,
      lineTotal,
    });

    totalCharges = totalCharges.add(lineTotal);
  }

  // Carry forward existing adjustments and discounts
  const adjustments = await prisma.invoiceAdjustment.findMany({
    where: { invoiceId: existing.id },
  });
  const discounts = await prisma.invoiceDiscount.findMany({
    where: { invoiceId: existing.id },
  });

  let totalAdjustments = new Prisma.Decimal(0);
  for (const adj of adjustments) {
    if (adj.adjustmentType === 'debit') {
      totalAdjustments = totalAdjustments.add(adj.amount);
    } else {
      totalAdjustments = totalAdjustments.sub(adj.amount);
    }
  }

  let totalDiscounts = new Prisma.Decimal(0);
  for (const disc of discounts) {
    totalDiscounts = totalDiscounts.add(disc.amount);
  }

  const openingBalance = existing.openingBalance;
  const totalPayments = existing.totalPayments;

  const closingBalance = new Prisma.Decimal(openingBalance.toString())
    .add(totalCharges)
    .sub(totalDiscounts)
    .add(totalAdjustments)
    .sub(new Prisma.Decimal(totalPayments.toString()));

  const paymentStatus = closingBalance.lte(0) ? 'paid' : totalPayments.gt(0) ? 'partial' : 'unpaid';

  const newInvoice = await prisma.$transaction(async (tx) => {
    // Mark old invoice as superseded
    await tx.invoice.update({
      where: { id: existing.id },
      data: { isCurrent: false },
    });

    // Create new version
    const inv = await tx.invoice.create({
      data: {
        customerId: existing.customerId,
        billingCycleStart: cycleStart,
        billingCycleEnd: cycleEnd,
        version: existing.version + 1,
        openingBalance,
        totalCharges,
        totalDiscounts,
        totalAdjustments,
        totalPayments,
        closingBalance,
        paymentStatus,
        isCurrent: true,
        generatedAt: new Date(),
      },
    });

    // Create line items
    if (lineItems.length > 0) {
      await tx.invoiceLineItem.createMany({
        data: lineItems.map((li) => ({
          invoiceId: inv.id,
          deliveryOrderId: li.deliveryOrderId,
          productVariantId: li.productVariantId,
          deliveryDate: li.deliveryDate,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          lineTotal: li.lineTotal,
        })),
      });
    }

    // Copy adjustments to new invoice
    for (const adj of adjustments) {
      await tx.invoiceAdjustment.create({
        data: {
          invoiceId: inv.id,
          adjustmentType: adj.adjustmentType,
          amount: adj.amount,
          reason: adj.reason,
          createdBy: adj.createdBy,
        },
      });
    }

    // Copy discounts to new invoice
    for (const disc of discounts) {
      await tx.invoiceDiscount.create({
        data: {
          invoiceId: inv.id,
          discountType: disc.discountType,
          value: disc.value,
          amount: disc.amount,
          description: disc.description,
          createdBy: disc.createdBy,
        },
      });
    }

    return inv;
  });

  return newInvoice;
}

// ---------------------------------------------------------------------------
// Get invoice detail (Req 9.9 — data for PDF, detail view)
// ---------------------------------------------------------------------------
export async function getInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      lineItems: {
        include: {
          productVariant: {
            include: { product: { select: { name: true } } },
          },
        },
        orderBy: { deliveryDate: 'asc' },
      },
      adjustments: { orderBy: { createdAt: 'asc' } },
      discounts: { orderBy: { createdAt: 'asc' } },
      payments: { orderBy: { paymentDate: 'asc' } },
    },
  });

  if (!invoice) throw new NotFoundError('Invoice not found');
  return invoice;
}

// ---------------------------------------------------------------------------
// List invoices with filtering and pagination
// ---------------------------------------------------------------------------
export async function listInvoices(query: ListInvoicesQuery) {
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);

  const where: Prisma.InvoiceWhereInput = { isCurrent: true };

  if (query.customerId) where.customerId = query.customerId;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
  if (query.cycleStart) {
    where.billingCycleStart = { gte: new Date(query.cycleStart + 'T00:00:00.000Z') };
  }
  if (query.cycleEnd) {
    where.billingCycleEnd = { lte: new Date(query.cycleEnd + 'T00:00:00.000Z') };
  }

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { generatedAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.invoice.count({ where }),
  ]);

  return paginatedResponse(items, total, pagination);
}

// ---------------------------------------------------------------------------
// Add manual adjustment to invoice (Req 9.5)
// ---------------------------------------------------------------------------
export async function addAdjustment(invoiceId: string, input: AddAdjustmentInput, userId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice not found');
  if (!invoice.isCurrent) {
    throw new ValidationError('Cannot adjust a superseded invoice', {
      id: ['Invoice is not the current version'],
    });
  }

  const amount = new Prisma.Decimal(input.amount);

  return prisma.$transaction(async (tx) => {
    // Create the adjustment record
    await tx.invoiceAdjustment.create({
      data: {
        invoiceId,
        adjustmentType: input.adjustmentType,
        amount,
        reason: input.reason,
        createdBy: userId,
      },
    });

    // Create ledger entry for the adjustment (Req 21.1)
    await createLedgerEntry(tx, {
      customerId: invoice.customerId,
      entryDate: new Date(),
      transactionType: 'adjustment',
      referenceType: 'adjustment',
      referenceId: invoiceId,
      debitAmount: input.adjustmentType === 'debit' ? amount : new Prisma.Decimal(0),
      creditAmount: input.adjustmentType === 'credit' ? amount : new Prisma.Decimal(0),
      description: `${input.adjustmentType} adjustment: ${input.reason}`,
    });

    // Recalculate totalAdjustments from all adjustments on this invoice
    const allAdjustments = await tx.invoiceAdjustment.findMany({
      where: { invoiceId },
    });

    let totalAdjustments = new Prisma.Decimal(0);
    for (const adj of allAdjustments) {
      if (adj.adjustmentType === 'debit') {
        totalAdjustments = totalAdjustments.add(adj.amount);
      } else {
        totalAdjustments = totalAdjustments.sub(adj.amount);
      }
    }

    // Recalculate closing balance
    const closingBalance = new Prisma.Decimal(invoice.openingBalance.toString())
      .add(new Prisma.Decimal(invoice.totalCharges.toString()))
      .sub(new Prisma.Decimal(invoice.totalDiscounts.toString()))
      .add(totalAdjustments)
      .sub(new Prisma.Decimal(invoice.totalPayments.toString()));

    // Determine payment status
    const totalPayments = new Prisma.Decimal(invoice.totalPayments.toString());
    const paymentStatus = closingBalance.lte(0)
      ? 'paid'
      : totalPayments.gt(0)
        ? 'partial'
        : 'unpaid';

    // Update the invoice
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        totalAdjustments,
        closingBalance,
        paymentStatus,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        lineItems: { orderBy: { deliveryDate: 'asc' } },
        adjustments: { orderBy: { createdAt: 'asc' } },
        discounts: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { paymentDate: 'asc' } },
      },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Add discount to invoice (Req 9.6)
// ---------------------------------------------------------------------------
export async function addDiscount(invoiceId: string, input: AddDiscountInput, userId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice not found');
  if (!invoice.isCurrent) {
    throw new ValidationError('Cannot add discount to a superseded invoice', {
      id: ['Invoice is not the current version'],
    });
  }

  // Calculate the discount amount
  const totalCharges = new Prisma.Decimal(invoice.totalCharges.toString());
  const value = new Prisma.Decimal(input.value);
  const discountAmount = input.discountType === 'percentage'
    ? totalCharges.mul(value).div(100)
    : value;

  return prisma.$transaction(async (tx) => {
    // Create the discount record
    await tx.invoiceDiscount.create({
      data: {
        invoiceId,
        discountType: input.discountType,
        value,
        amount: discountAmount,
        description: input.description ?? null,
        createdBy: userId,
      },
    });

    // Recalculate totalDiscounts from all discounts on this invoice
    const allDiscounts = await tx.invoiceDiscount.findMany({
      where: { invoiceId },
    });

    let totalDiscounts = new Prisma.Decimal(0);
    for (const disc of allDiscounts) {
      totalDiscounts = totalDiscounts.add(disc.amount);
    }

    // Recalculate closing balance
    const closingBalance = new Prisma.Decimal(invoice.openingBalance.toString())
      .add(totalCharges)
      .sub(totalDiscounts)
      .add(new Prisma.Decimal(invoice.totalAdjustments.toString()))
      .sub(new Prisma.Decimal(invoice.totalPayments.toString()));

    // Determine payment status
    const totalPayments = new Prisma.Decimal(invoice.totalPayments.toString());
    const paymentStatus = closingBalance.lte(0)
      ? 'paid'
      : totalPayments.gt(0)
        ? 'partial'
        : 'unpaid';

    // Update the invoice
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        totalDiscounts,
        closingBalance,
        paymentStatus,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        lineItems: { orderBy: { deliveryDate: 'asc' } },
        adjustments: { orderBy: { createdAt: 'asc' } },
        discounts: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { paymentDate: 'asc' } },
      },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Generate invoice for a single customer's billing cycle (Req 3.4, 5.1, 5.8)
// ---------------------------------------------------------------------------
export async function generateInvoiceForCustomer(
  customerId: string,
  cycleStart: Date,
  cycleEnd: Date,
) {
  // Fetch customer with pricing category
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, pricingCategory: true },
  });
  if (!customer) throw new NotFoundError('Customer not found');

  // Query delivered orders for this customer within the cycle
  const deliveredOrders = await prisma.deliveryOrder.findMany({
    where: {
      customerId,
      status: 'delivered',
      deliveryDate: { gte: cycleStart, lte: cycleEnd },
    },
    include: { productVariant: true },
    orderBy: { deliveryDate: 'asc' },
  });

  // Get previous invoice closing balance as opening balance (Req 5.8)
  const previousInvoice = await prisma.invoice.findFirst({
    where: { customerId, isCurrent: true },
    orderBy: { billingCycleEnd: 'desc' },
  });

  let openingBalance = new Prisma.Decimal(0);
  if (previousInvoice && previousInvoice.billingCycleEnd < cycleStart) {
    openingBalance = previousInvoice.closingBalance;
  }

  // Build line items using customer's pricing category for price resolution
  const lineItems: {
    deliveryOrderId: string;
    productVariantId: string;
    deliveryDate: Date;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }[] = [];

  let totalCharges = new Prisma.Decimal(0);

  for (const order of deliveredOrders) {
    const priceRecord = await getEffectivePrice(
      order.productVariantId,
      order.deliveryDate,
      null,
      customer.pricingCategory,
    );

    const qty = new Prisma.Decimal(order.quantity.toString());
    const unitPrice = new Prisma.Decimal(priceRecord.price.toString());
    const lineTotal = qty.mul(unitPrice);

    lineItems.push({
      deliveryOrderId: order.id,
      productVariantId: order.productVariantId,
      deliveryDate: order.deliveryDate,
      quantity: qty,
      unitPrice,
      lineTotal,
    });

    totalCharges = totalCharges.add(lineTotal);
  }

  const totalDiscounts = new Prisma.Decimal(0);
  const totalAdjustments = new Prisma.Decimal(0);
  const totalPayments = new Prisma.Decimal(0);
  const closingBalance = openingBalance
    .add(totalCharges)
    .sub(totalDiscounts)
    .add(totalAdjustments)
    .sub(totalPayments);

  const paymentStatus = closingBalance.lte(0) ? 'paid' : 'unpaid';

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        customerId,
        billingCycleStart: cycleStart,
        billingCycleEnd: cycleEnd,
        version: 1,
        openingBalance,
        totalCharges,
        totalDiscounts,
        totalAdjustments,
        totalPayments,
        closingBalance,
        paymentStatus,
        isCurrent: true,
        generatedAt: new Date(),
      },
    });

    if (lineItems.length > 0) {
      await tx.invoiceLineItem.createMany({
        data: lineItems.map((li) => ({
          invoiceId: inv.id,
          deliveryOrderId: li.deliveryOrderId,
          productVariantId: li.productVariantId,
          deliveryDate: li.deliveryDate,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          lineTotal: li.lineTotal,
        })),
      });
    }

    if (totalCharges.gt(0)) {
      const startStr = cycleStart.toISOString().slice(0, 10);
      const endStr = cycleEnd.toISOString().slice(0, 10);
      await createLedgerEntry(tx, {
        customerId,
        entryDate: cycleEnd,
        transactionType: 'charge',
        referenceType: 'invoice',
        referenceId: inv.id,
        debitAmount: totalCharges,
        creditAmount: new Prisma.Decimal(0),
        description: `Invoice charges for ${startStr} to ${endStr}`,
      });
    }

    return inv;
  });

  return invoice;
}

// ---------------------------------------------------------------------------
// Daily billing job — process all customers whose cycle has ended (Req 5.2, 6.2, 6.3, 6.4)
// ---------------------------------------------------------------------------
export async function runDailyBillingJob(today: Date = new Date()) {
  const activeCustomers = await prisma.customer.findMany({
    where: { status: 'active' },
    select: { id: true, billingFrequency: true },
  });

  let invoicesCreated = 0;
  const errors: { customerId: string; error: string }[] = [];

  for (const customer of activeCustomers) {
    try {
      // Find the most recent invoice for this customer to determine next cycle
      const lastInvoice = await prisma.invoice.findFirst({
        where: { customerId: customer.id, isCurrent: true },
        orderBy: { billingCycleEnd: 'desc' },
        select: { billingCycleEnd: true, billingCycleStart: true },
      });

      let nextCycle;
      if (lastInvoice) {
        nextCycle = getNextCycle(customer.billingFrequency, lastInvoice.billingCycleEnd);
      } else {
        // No prior invoice — use the cycle containing today
        nextCycle = getCycleForDate(customer.billingFrequency, today);
      }

      // Skip if cycle hasn't ended yet
      if (!isCycleComplete(nextCycle, today)) continue;

      // Skip if an invoice already covers this cycle
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          customerId: customer.id,
          isCurrent: true,
          billingCycleStart: nextCycle.start,
          billingCycleEnd: nextCycle.end,
        },
      });
      if (existingInvoice) continue;

      await generateInvoiceForCustomer(customer.id, nextCycle.start, nextCycle.end);
      invoicesCreated++;
    } catch (err) {
      errors.push({
        customerId: customer.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    customersProcessed: activeCustomers.length,
    invoicesCreated,
    errors,
  };
}
