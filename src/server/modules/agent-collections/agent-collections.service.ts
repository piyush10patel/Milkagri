import { prisma } from '../../index.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { Prisma } from '@prisma/client';
import { createLedgerEntry } from '../ledger/ledger.service.js';
import type {
  RecordAgentCollectionInput,
  CollectionSummaryQuery,
  AgentDashboardQuery,
} from './agent-collections.types.js';

// ---------------------------------------------------------------------------
// Record a field collection by a delivery agent (Req 2.1, 2.2, 2.3, 2.4, 2.5)
// ---------------------------------------------------------------------------
export async function recordAgentCollection(
  input: RecordAgentCollectionInput,
  agentUserId: string,
) {
  // Verify the customer is assigned to this agent
  const assignment = await prisma.customerAgentAssignment.findUnique({
    where: { customerId: input.customerId },
  });

  if (!assignment || assignment.agentId !== agentUserId) {
    throw new ForbiddenError('Customer is not assigned to you');
  }

  const amount = new Prisma.Decimal(input.amount);
  const paymentDate = new Date(input.paymentDate + 'T00:00:00.000Z');

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        customerId: input.customerId,
        amount,
        paymentMethod: input.paymentMethod,
        paymentDate,
        collectedBy: agentUserId,
        isFieldCollection: true,
        recordedBy: agentUserId,
      },
    });

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
// Daily collection summary — expected vs received per agent (Req 3.1–3.4, 4.1–4.4)
// ---------------------------------------------------------------------------
export async function getDailyCollectionSummary(query: CollectionSummaryQuery) {
  const targetDate = new Date(query.date + 'T00:00:00.000Z');

  // Get all agents that have at least one assignment
  const assignments = await prisma.customerAgentAssignment.findMany({
    include: {
      agent: { select: { id: true, name: true, email: true } },
    },
  });

  // Group assignments by agent
  const agentCustomerMap = new Map<
    string,
    { agent: { id: string; name: string; email: string }; customerIds: string[] }
  >();

  for (const a of assignments) {
    if (!agentCustomerMap.has(a.agentId)) {
      agentCustomerMap.set(a.agentId, { agent: a.agent, customerIds: [] });
    }
    agentCustomerMap.get(a.agentId)!.customerIds.push(a.customerId);
  }

  // Fetch the latest ledger balance for all assigned customers in a single query
  const allCustomerIds = Array.from(new Set(assignments.map(a => a.customerId)));
  const latestEntries: { customerId: string; runningBalance: Prisma.Decimal }[] = [];

  // Batch query to avoid memory overload with many customers
  const batchSize = 100;
  for (let i = 0; i < allCustomerIds.length; i += batchSize) {
    const batch = allCustomerIds.slice(i, i + batchSize);
    const entries = await prisma.ledgerEntry.findMany({
      where: { customerId: { in: batch } },
      distinct: ['customerId'],
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      select: { customerId: true, runningBalance: true },
    });
    latestEntries.push(...entries);
  }

  const latestBalanceMap = new Map<string, Prisma.Decimal>();
  for (const entry of latestEntries) {
    if (entry.runningBalance.gt(0)) {
      latestBalanceMap.set(entry.customerId, entry.runningBalance);
    }
  }

  const agentSummaries = [];

  for (const [agentId, { agent, customerIds }] of agentCustomerMap) {
    // Expected: sum of positive running balances from latest ledger entry per customer
    let expected = new Prisma.Decimal(0);
    for (const customerId of customerIds) {
      const balance = latestBalanceMap.get(customerId);
      if (balance) {
        expected = expected.add(balance);
      }
    }
    // Received: sum of field collections by this agent on the target date
    const receivedAgg = await prisma.payment.aggregate({
      where: {
        isFieldCollection: true,
        collectedBy: agentId,
        paymentDate: targetDate,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const received = receivedAgg._sum.amount ?? new Prisma.Decimal(0);
    const collectionCount = receivedAgg._count.id;
    const difference = expected.sub(received);

    agentSummaries.push({
      agent,
      expected,
      received,
      difference,
      collectionCount,
    });
  }

  return agentSummaries;
}


// ---------------------------------------------------------------------------
// Agent dashboard — assigned customers, balances, collection status (Req 6.1–6.5)
// ---------------------------------------------------------------------------
export async function getAgentDashboard(agentId: string, query: AgentDashboardQuery) {
  const dateStr = query.date ?? new Date().toISOString().slice(0, 10);
  const targetDate = new Date(dateStr + 'T00:00:00.000Z');

  // Verify agent exists
  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent) throw new NotFoundError('Delivery agent not found');

  // Get all assigned customers
  const assignments = await prisma.customerAgentAssignment.findMany({
    where: { agentId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  });

  const customerIds = assignments.map((a) => a.customerId);

  // Bulk fetch latest ledger balances for all assigned customers
  const latestEntries = await prisma.ledgerEntry.findMany({
    where: { customerId: { in: customerIds } },
    distinct: ['customerId'],
    orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    select: { customerId: true, runningBalance: true },
  });

  const balanceMap = new Map<string, Prisma.Decimal>();
  for (const entry of latestEntries) {
    balanceMap.set(entry.customerId, entry.runningBalance);
  }

  // Bulk fetch all payments for these customers by this agent on target date
  const collections = await prisma.payment.findMany({
    where: {
      customerId: { in: customerIds },
      isFieldCollection: true,
      collectedBy: agentId,
      paymentDate: targetDate,
    },
    select: { customerId: true, amount: true },
  });

  const paymentMap = new Map<string, Prisma.Decimal>();
  for (const c of collections) {
    const current = paymentMap.get(c.customerId) ?? new Prisma.Decimal(0);
    paymentMap.set(c.customerId, current.add(c.amount));
  }

  let totalExpected = new Prisma.Decimal(0);
  let totalReceived = new Prisma.Decimal(0);

  const customers = assignments.map((assignment) => {
    const customerId = assignment.customerId;
    const balance = balanceMap.get(customerId) ?? new Prisma.Decimal(0);
    const receivedAmount = paymentMap.get(customerId) ?? new Prisma.Decimal(0);
    const paid = paymentMap.has(customerId);

    if (balance.gt(0)) {
      totalExpected = totalExpected.add(balance);
    }
    totalReceived = totalReceived.add(receivedAmount);

    return {
      customer: assignment.customer,
      balance,
      paid,
    };
  });

  const remaining = totalExpected.sub(totalReceived);

  return {
    date: dateStr,
    customers,
    totalExpected,
    totalReceived,
    remaining,
  };
}
