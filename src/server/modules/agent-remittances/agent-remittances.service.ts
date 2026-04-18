import { prisma } from '../../index.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { Prisma } from '@prisma/client';
import type { RecordRemittanceInput, ListRemittancesQuery } from './agent-remittances.types.js';

// ---------------------------------------------------------------------------
// Get un-remitted balance for a single agent (Req 5.3, 8.1)
// ---------------------------------------------------------------------------
export async function getUnremittedBalance(agentId: string): Promise<Prisma.Decimal> {
  const [collectionsAgg, remittancesAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: { isFieldCollection: true, collectedBy: agentId },
      _sum: { amount: true },
    }),
    prisma.agentRemittance.aggregate({
      where: { agentId },
      _sum: { amount: true },
    }),
  ]);

  const totalCollected = collectionsAgg._sum.amount ?? new Prisma.Decimal(0);
  const totalRemitted = remittancesAgg._sum.amount ?? new Prisma.Decimal(0);

  return totalCollected.sub(totalRemitted);
}

// ---------------------------------------------------------------------------
// Record a remittance from agent to admin (Req 5.1, 5.2, 5.4, 5.5)
// ---------------------------------------------------------------------------
export async function recordRemittance(
  input: RecordRemittanceInput,
  adminUserId: string,
) {
  const { agentId, amount, paymentMethod, remittanceDate, notes } = input;

  // Validate agent exists and has delivery_agent role
  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent) {
    throw new NotFoundError('Delivery agent not found');
  }
  if (agent.role !== 'delivery_agent') {
    throw new ValidationError('User is not a delivery agent');
  }

  // Calculate un-remitted balance and reject if amount exceeds it
  const balance = await getUnremittedBalance(agentId);
  const remittanceAmount = new Prisma.Decimal(amount);

  if (remittanceAmount.gt(balance)) {
    throw new ValidationError('Remittance amount exceeds un-remitted balance');
  }

  return prisma.agentRemittance.create({
    data: {
      agentId,
      amount: remittanceAmount,
      paymentMethod,
      remittanceDate: new Date(remittanceDate + 'T00:00:00.000Z'),
      notes: notes ?? null,
      receivedBy: adminUserId,
    },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      receiver: { select: { id: true, name: true, email: true } },
    },
  });
}


// ---------------------------------------------------------------------------
// List remittances — paginated with filters (Req 5.6)
// ---------------------------------------------------------------------------
export async function listRemittances(query: ListRemittancesQuery) {
  const { agentId, startDate, endDate, page, limit } = query;
  const pagination = parsePagination(page, limit);

  const where: Prisma.AgentRemittanceWhereInput = {};

  if (agentId) {
    where.agentId = agentId;
  }

  if (startDate || endDate) {
    where.remittanceDate = {};
    if (startDate) {
      where.remittanceDate.gte = new Date(startDate + 'T00:00:00.000Z');
    }
    if (endDate) {
      where.remittanceDate.lte = new Date(endDate + 'T00:00:00.000Z');
    }
  }

  const [items, total] = await Promise.all([
    prisma.agentRemittance.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.agentRemittance.count({ where }),
  ]);

  return paginatedResponse(items, total, pagination);
}

// ---------------------------------------------------------------------------
// Get all agents with un-remitted balances (Req 8.1, 8.2, 8.3, 8.4)
// ---------------------------------------------------------------------------
export async function getAgentBalances() {
  // Get all delivery agents that have at least one field collection
  const agentsWithCollections = await prisma.payment.findMany({
    where: { isFieldCollection: true, collectedBy: { not: null } },
    select: { collectedBy: true },
    distinct: ['collectedBy'],
  });

  const agentIds = agentsWithCollections
    .map((p) => p.collectedBy)
    .filter((id): id is string => id !== null);

  if (agentIds.length === 0) {
    return [];
  }

  // Fetch agent details
  const agents = await prisma.user.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true, email: true },
  });

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  // Calculate balance for each agent
  const balances = await Promise.all(
    agentIds.map(async (agentId) => {
      const balance = await getUnremittedBalance(agentId);
      const agent = agentMap.get(agentId);
      return {
        agent: agent ?? { id: agentId, name: 'Unknown', email: '' },
        unremittedBalance: balance,
        pending: balance.gt(0),
      };
    }),
  );

  // Sort descending by un-remitted balance
  balances.sort((a, b) => {
    if (a.unremittedBalance.gt(b.unremittedBalance)) return -1;
    if (a.unremittedBalance.lt(b.unremittedBalance)) return 1;
    return 0;
  });

  return balances;
}
