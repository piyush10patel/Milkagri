import { prisma } from '../../index.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { Prisma } from '@prisma/client';
import type {
  RecordPaymentInput,
  RecordCollectionInput,
  OutstandingQuery,
} from './payments.types.js';
import { createLedgerEntry } from '../ledger/ledger.service.js';

// ---------------------------------------------------------------------------
// Record a payment (Req 10.1, 10.2, 10.3, 10.4, 10.5)
// ---------------------------------------------------------------------------
export async function recordPayment(input: RecordPaymentInput, userId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new NotFoundError('Customer not found');

  const amount = new Prisma.Decimal(input.amount);
  const paymentDate = new Date(input.paymentDate + 'T00:00:00.000Z');

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        customerId: input.customerId,
        invoiceId: input.invoiceId ?? null,
        amount,
        paymentMethod: input.paymentMethod,
        paymentMethodDescription: input.paymentMethodDescription ?? null,
        paymentDate,
        isFieldCollection: false,
        recordedBy: userId,
      },
    });

    // If payment is against a specific invoice, update that invoice
    if (input.invoiceId) {
      await applyPaymentToInvoice(tx, input.invoiceId, amount);
    }

    // Create ledger entry for the payment (Req 21.1)
    await createLedgerEntry(tx, {
      customerId: input.customerId,
      entryDate: paymentDate,
      transactionType: 'payment',
      referenceType: 'payment',
      referenceId: payment.id,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: amount,
      description: `Payment via ${input.paymentMethod}${input.invoiceId ? ' against invoice' : ' (advance)'}`,
    });

    return payment;
  });
}


// ---------------------------------------------------------------------------
// Record a field collection by delivery agent (Req 10.6, 10.7)
// ---------------------------------------------------------------------------
export async function recordCollection(input: RecordCollectionInput, agentUserId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
  if (!customer) throw new NotFoundError('Customer not found');

  const amount = new Prisma.Decimal(input.amount);
  const paymentDate = new Date(input.paymentDate + 'T00:00:00.000Z');

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        customerId: input.customerId,
        invoiceId: input.invoiceId ?? null,
        amount,
        paymentMethod: input.paymentMethod,
        paymentMethodDescription: input.paymentMethodDescription ?? null,
        paymentDate,
        collectedBy: agentUserId,
        isFieldCollection: true,
        recordedBy: agentUserId,
      },
    });

    // If payment is against a specific invoice, update that invoice
    if (input.invoiceId) {
      await applyPaymentToInvoice(tx, input.invoiceId, amount);
    }

    // Create ledger entry for the field collection (Req 21.1)
    await createLedgerEntry(tx, {
      customerId: input.customerId,
      entryDate: paymentDate,
      transactionType: 'payment',
      referenceType: 'payment',
      referenceId: payment.id,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: amount,
      description: `Field collection via ${input.paymentMethod}`,
    });

    return payment;
  });
}

// ---------------------------------------------------------------------------
// Apply payment amount to an invoice — update totals and status (Req 10.3)
// ---------------------------------------------------------------------------
async function applyPaymentToInvoice(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  paymentAmount: Prisma.Decimal,
) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice not found');
  if (!invoice.isCurrent) {
    throw new ValidationError('Cannot apply payment to a superseded invoice', {
      invoiceId: ['Invoice is not the current version'],
    });
  }

  const newTotalPayments = new Prisma.Decimal(invoice.totalPayments.toString()).add(paymentAmount);

  // Recalculate closing balance
  const closingBalance = new Prisma.Decimal(invoice.openingBalance.toString())
    .add(new Prisma.Decimal(invoice.totalCharges.toString()))
    .sub(new Prisma.Decimal(invoice.totalDiscounts.toString()))
    .add(new Prisma.Decimal(invoice.totalAdjustments.toString()))
    .sub(newTotalPayments);

  // Determine payment status (Req 10.3, 9.10, 9.11)
  let paymentStatus: 'unpaid' | 'partial' | 'paid';
  if (closingBalance.lte(0)) {
    paymentStatus = 'paid';
  } else if (newTotalPayments.gt(0)) {
    paymentStatus = 'partial';
  } else {
    paymentStatus = 'unpaid';
  }

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      totalPayments: newTotalPayments,
      closingBalance,
      paymentStatus,
    },
  });
}

// ---------------------------------------------------------------------------
// Collection reconciliation (Req 10.8)
// ---------------------------------------------------------------------------
export async function getCollectionReconciliation(date: string) {
  const targetDate = new Date(date + 'T00:00:00.000Z');

  const collections = await prisma.payment.findMany({
    where: {
      isFieldCollection: true,
      paymentDate: targetDate,
    },
    include: {
      collector: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by agent
  const byAgent = new Map<string, {
    agent: { id: string; name: string };
    collections: typeof collections;
    totalCollected: Prisma.Decimal;
  }>();

  for (const c of collections) {
    const agentId = c.collectedBy ?? 'unknown';
    const agentName = c.collector?.name ?? 'Unknown';
    if (!byAgent.has(agentId)) {
      byAgent.set(agentId, {
        agent: { id: agentId, name: agentName },
        collections: [],
        totalCollected: new Prisma.Decimal(0),
      });
    }
    const entry = byAgent.get(agentId)!;
    entry.collections.push(c);
    entry.totalCollected = entry.totalCollected.add(c.amount);
  }

  return {
    date,
    agents: Array.from(byAgent.values()).map((entry) => ({
      agent: entry.agent,
      totalCollected: entry.totalCollected,
      collectionCount: entry.collections.length,
      collections: entry.collections,
    })),
    grandTotal: collections.reduce(
      (sum, c) => sum.add(c.amount),
      new Prisma.Decimal(0),
    ),
  };
}

// ---------------------------------------------------------------------------
// Customer outstanding summary (Req 10.9)
// ---------------------------------------------------------------------------
export async function getOutstandingSummary(query: OutstandingQuery) {
  const { page, limit } = query;
  const pagination = parsePagination(page, limit);

  // Find all current invoices that are not fully paid
  const where: Prisma.InvoiceWhereInput = {
    isCurrent: true,
    paymentStatus: { in: ['unpaid', 'partial'] },
  };

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { closingBalance: 'desc' },
  });

  // Aggregate by customer
  const customerMap = new Map<string, {
    customer: { id: string; name: string; phone: string };
    totalOutstanding: Prisma.Decimal;
    invoiceCount: number;
    oldestUnpaidDate: Date | null;
  }>();

  for (const inv of invoices) {
    if (!customerMap.has(inv.customerId)) {
      customerMap.set(inv.customerId, {
        customer: inv.customer,
        totalOutstanding: new Prisma.Decimal(0),
        invoiceCount: 0,
        oldestUnpaidDate: null,
      });
    }
    const entry = customerMap.get(inv.customerId)!;
    entry.totalOutstanding = entry.totalOutstanding.add(inv.closingBalance);
    entry.invoiceCount += 1;
    if (!entry.oldestUnpaidDate || inv.billingCycleStart < entry.oldestUnpaidDate) {
      entry.oldestUnpaidDate = inv.billingCycleStart;
    }
  }

  let items = Array.from(customerMap.values());

  // Sort
  if (query.sortBy === 'name') {
    const dir = query.sortOrder === 'asc' ? 1 : -1;
    items.sort((a, b) => a.customer.name.localeCompare(b.customer.name) * dir);
  } else {
    // Default: sort by outstanding amount descending
    items.sort((a, b) => {
      const aVal = parseFloat(a.totalOutstanding.toString());
      const bVal = parseFloat(b.totalOutstanding.toString());
      return query.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }

  const total = items.length;
  const paged = items.slice(pagination.skip, pagination.skip + pagination.take);

  return paginatedResponse(paged, total, pagination);
}
