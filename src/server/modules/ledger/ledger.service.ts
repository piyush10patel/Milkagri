import { prisma } from '../../index.js';
import { NotFoundError } from '../../lib/errors.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { Prisma, TransactionType } from '@prisma/client';
import type { LedgerQuery } from './ledger.types.js';

// ---------------------------------------------------------------------------
// Get the current running balance for a customer (Req 21.2)
// Returns 0 if no entries exist yet.
// ---------------------------------------------------------------------------
export async function getRunningBalance(customerId: string): Promise<Prisma.Decimal> {
  const lastEntry = await prisma.ledgerEntry.findFirst({
    where: { customerId },
    orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    select: { runningBalance: true },
  });
  return lastEntry?.runningBalance ?? new Prisma.Decimal(0);
}

// ---------------------------------------------------------------------------
// Create a ledger entry (Req 21.1, 21.2)
// Calculates running balance as: previous balance + debit - credit
// ---------------------------------------------------------------------------
export async function createLedgerEntry(
  tx: Prisma.TransactionClient,
  data: {
    customerId: string;
    entryDate: Date;
    transactionType: TransactionType;
    referenceType?: string;
    referenceId?: string;
    debitAmount: Prisma.Decimal;
    creditAmount: Prisma.Decimal;
    description?: string;
  },
) {
  // Get the latest running balance within this transaction
  const lastEntry = await tx.ledgerEntry.findFirst({
    where: { customerId: data.customerId },
    orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    select: { runningBalance: true },
  });

  const previousBalance = lastEntry?.runningBalance ?? new Prisma.Decimal(0);
  const runningBalance = previousBalance.add(data.debitAmount).sub(data.creditAmount);

  return tx.ledgerEntry.create({
    data: {
      customerId: data.customerId,
      entryDate: data.entryDate,
      transactionType: data.transactionType,
      referenceType: data.referenceType ?? null,
      referenceId: data.referenceId ?? null,
      debitAmount: data.debitAmount,
      creditAmount: data.creditAmount,
      runningBalance,
      description: data.description ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Query ledger entries for a customer in chronological order (Req 21.3)
// ---------------------------------------------------------------------------
export async function getLedgerEntries(customerId: string, query: LedgerQuery) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new NotFoundError('Customer not found');

  const { page, limit } = query;
  const pagination = parsePagination(page, limit);

  const where: Prisma.LedgerEntryWhereInput = { customerId };

  if (query.startDate || query.endDate) {
    where.entryDate = {};
    if (query.startDate) {
      where.entryDate.gte = new Date(query.startDate + 'T00:00:00.000Z');
    }
    if (query.endDate) {
      where.entryDate.lte = new Date(query.endDate + 'T00:00:00.000Z');
    }
  }

  const [items, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.ledgerEntry.count({ where }),
  ]);

  return paginatedResponse(items, total, pagination);
}

// ---------------------------------------------------------------------------
// Get all ledger entries for a date range (for PDF export) (Req 21.4, 21.5)
// ---------------------------------------------------------------------------
export async function getLedgerEntriesForRange(
  customerId: string,
  startDate: string,
  endDate: string,
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, phone: true, email: true },
  });
  if (!customer) throw new NotFoundError('Customer not found');

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      customerId,
      entryDate: {
        gte: new Date(startDate + 'T00:00:00.000Z'),
        lte: new Date(endDate + 'T00:00:00.000Z'),
      },
    },
    orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
  });

  return { customer, entries, startDate, endDate };
}
