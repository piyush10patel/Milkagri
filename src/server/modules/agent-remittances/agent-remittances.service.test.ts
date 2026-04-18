import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockPaymentAggregate = vi.fn();
const mockPaymentFindMany = vi.fn();
const mockRemittanceAggregate = vi.fn();
const mockRemittanceCreate = vi.fn();
const mockRemittanceFindMany = vi.fn();
const mockRemittanceCount = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    payment: {
      aggregate: (...args: any[]) => mockPaymentAggregate(...args),
      findMany: (...args: any[]) => mockPaymentFindMany(...args),
    },
    agentRemittance: {
      aggregate: (...args: any[]) => mockRemittanceAggregate(...args),
      create: (...args: any[]) => mockRemittanceCreate(...args),
      findMany: (...args: any[]) => mockRemittanceFindMany(...args),
      count: (...args: any[]) => mockRemittanceCount(...args),
    },
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
      findMany: (...args: any[]) => mockUserFindMany(...args),
    },
  },
  redis: {},
}));

import {
  getUnremittedBalance,
  recordRemittance,
  listRemittances,
  getAgentBalances,
} from './agent-remittances.service.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------
const uuidArb = fc.uuid();
const positiveAmountArb = fc
  .double({ min: 0.01, max: 99999, noNaN: true })
  .map((n) => Math.round(n * 100) / 100);
const paymentMethodArb = fc.constantFrom('cash', 'upi', 'bank_transfer', 'card', 'other');
const dateStrArb = fc
  .integer({ min: 0, max: 730 })
  .map((offset) => {
    const d = new Date(2024, 0, 1 + offset);
    return d.toISOString().slice(0, 10);
  });

// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 9: Un-remitted balance invariant
// Validates: Requirements 5.3, 5.4, 8.1, 8.2
// ---------------------------------------------------------------------------
describe('Property 9: Un-remitted balance invariant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('un-remitted balance equals total field collections minus total remittances', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        positiveAmountArb,
        positiveAmountArb,
        async (agentId, totalCollected, totalRemitted) => {
          vi.clearAllMocks();

          mockPaymentAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(totalCollected) },
          });
          mockRemittanceAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(totalRemitted) },
          });

          const balance = await getUnremittedBalance(agentId);
          const expected = totalCollected - totalRemitted;

          expect(Number(balance)).toBeCloseTo(expected, 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('recording a remittance of amount X reduces un-remitted balance by exactly X', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        positiveAmountArb,
        paymentMethodArb,
        dateStrArb,
        async (agentId, adminId, remittanceAmount, paymentMethod, remittanceDate) => {
          // Ensure the un-remitted balance is always >= remittanceAmount
          const totalCollected = remittanceAmount + 100;
          const totalRemitted = 50;
          const balanceBefore = totalCollected - totalRemitted;

          fc.pre(remittanceAmount <= balanceBefore);
          vi.clearAllMocks();

          // Mock agent exists
          mockUserFindUnique.mockResolvedValue({
            id: agentId,
            name: 'Agent',
            email: 'agent@test.com',
            role: 'delivery_agent',
          });

          // Mock balance calculation for recordRemittance validation
          mockPaymentAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(totalCollected) },
          });
          mockRemittanceAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(totalRemitted) },
          });

          // Mock remittance creation
          mockRemittanceCreate.mockResolvedValue({
            id: 'rem-1',
            agentId,
            amount: new Prisma.Decimal(remittanceAmount),
            paymentMethod,
            remittanceDate: new Date(remittanceDate + 'T00:00:00.000Z'),
            notes: null,
            receivedBy: adminId,
            agent: { id: agentId, name: 'Agent', email: 'agent@test.com' },
            receiver: { id: adminId, name: 'Admin', email: 'admin@test.com' },
          });

          await recordRemittance(
            { agentId, amount: remittanceAmount, paymentMethod: paymentMethod as any, remittanceDate },
            adminId,
          );

          // Now simulate the balance after remittance
          vi.clearAllMocks();
          mockPaymentAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(totalCollected) },
          });
          mockRemittanceAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(totalRemitted + remittanceAmount) },
          });

          const balanceAfter = await getUnremittedBalance(agentId);
          const expectedAfter = balanceBefore - remittanceAmount;

          expect(Number(balanceAfter)).toBeCloseTo(expectedAfter, 1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 10: Remittance rejection on overpayment
// Validates: Requirements 5.5
// ---------------------------------------------------------------------------
describe('Property 10: Remittance rejection on overpayment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('any remittance amount exceeding un-remitted balance is rejected with an error', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        positiveAmountArb,
        positiveAmountArb,
        paymentMethodArb,
        dateStrArb,
        async (agentId, adminId, currentBalance, excess, paymentMethod, remittanceDate) => {
          vi.clearAllMocks();

          // remittanceAmount = currentBalance + excess, always exceeds balance
          const remittanceAmount = Math.round((currentBalance + excess) * 100) / 100;

          mockUserFindUnique.mockResolvedValue({
            id: agentId,
            name: 'Agent',
            email: 'agent@test.com',
            role: 'delivery_agent',
          });

          // Mock un-remitted balance = currentBalance
          mockPaymentAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(currentBalance) },
          });
          mockRemittanceAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(0) },
          });

          await expect(
            recordRemittance(
              {
                agentId,
                amount: remittanceAmount,
                paymentMethod: paymentMethod as any,
                remittanceDate,
              },
              adminId,
            ),
          ).rejects.toThrow('Remittance amount exceeds un-remitted balance');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 13: Agent balances ordering and flagging
// Validates: Requirements 8.3, 8.4
// ---------------------------------------------------------------------------
describe('Property 13: Agent balances ordering and flagging', () => {
  beforeEach(() => vi.clearAllMocks());

  it('balances list is sorted descending by balance; agents with balance > 0 are flagged pending, zero-balance agents are not', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            agentId: uuidArb,
            collected: positiveAmountArb,
            remitted: positiveAmountArb,
          }),
          { minLength: 1, maxLength: 6 },
        ),
        async (agentData) => {
          vi.clearAllMocks();

          // Deduplicate agent IDs
          const seen = new Set<string>();
          const uniqueAgents = agentData.filter((a) => {
            if (seen.has(a.agentId)) return false;
            seen.add(a.agentId);
            return true;
          });

          if (uniqueAgents.length === 0) return;

          // Mock distinct agents with collections
          mockPaymentFindMany.mockResolvedValue(
            uniqueAgents.map((a) => ({ collectedBy: a.agentId })),
          );

          // Mock user details
          mockUserFindMany.mockResolvedValue(
            uniqueAgents.map((a) => ({
              id: a.agentId,
              name: `Agent-${a.agentId.slice(0, 4)}`,
              email: `agent-${a.agentId.slice(0, 4)}@test.com`,
            })),
          );

          // Mock balance calculations for each agent
          let callIdx = 0;
          mockPaymentAggregate.mockImplementation(async () => {
            const agent = uniqueAgents[callIdx];
            const result = {
              _sum: { amount: new Prisma.Decimal(agent?.collected ?? 0) },
            };
            callIdx++;
            return result;
          });

          let remCallIdx = 0;
          mockRemittanceAggregate.mockImplementation(async () => {
            const agent = uniqueAgents[remCallIdx];
            const result = {
              _sum: { amount: new Prisma.Decimal(agent?.remitted ?? 0) },
            };
            remCallIdx++;
            return result;
          });

          const result = await getAgentBalances();

          // Verify descending sort
          for (let i = 1; i < result.length; i++) {
            const prev = Number(result[i - 1].unremittedBalance);
            const curr = Number(result[i].unremittedBalance);
            expect(prev).toBeGreaterThanOrEqual(curr);
          }

          // Verify flagging
          for (const entry of result) {
            const bal = Number(entry.unremittedBalance);
            if (bal > 0) {
              expect(entry.pending).toBe(true);
            } else {
              expect(entry.pending).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests: error cases and edge cases
// ---------------------------------------------------------------------------
describe('recordRemittance — error cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NotFoundError when agent does not exist', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      recordRemittance(
        {
          agentId: '00000000-0000-0000-0000-000000000001',
          amount: 100,
          paymentMethod: 'cash',
          remittanceDate: '2025-01-15',
        },
        '00000000-0000-0000-0000-000000000099',
      ),
    ).rejects.toThrow('Delivery agent not found');
  });
});

describe('listRemittances — remittance history listing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated remittance history for an agent', async () => {
    const remittances = [
      {
        id: 'rem-1',
        agentId: '00000000-0000-0000-0000-000000000001',
        amount: new Prisma.Decimal(500),
        paymentMethod: 'cash',
        remittanceDate: new Date('2025-01-15T00:00:00.000Z'),
        notes: null,
        receivedBy: '00000000-0000-0000-0000-000000000099',
        createdAt: new Date(),
        agent: { id: '00000000-0000-0000-0000-000000000001', name: 'Agent', email: 'agent@test.com' },
        receiver: { id: '00000000-0000-0000-0000-000000000099', name: 'Admin', email: 'admin@test.com' },
      },
    ];

    mockRemittanceFindMany.mockResolvedValue(remittances);
    mockRemittanceCount.mockResolvedValue(1);

    const result = await listRemittances({
      agentId: '00000000-0000-0000-0000-000000000001',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].agentId).toBe('00000000-0000-0000-0000-000000000001');
    expect(result.pagination.total).toBe(1);
  });
});

describe('getAgentBalances — zero-balance agent not flagged', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agent with zero un-remitted balance is not flagged as pending', async () => {
    const agentId = '00000000-0000-0000-0000-000000000001';

    mockPaymentFindMany.mockResolvedValue([{ collectedBy: agentId }]);
    mockUserFindMany.mockResolvedValue([
      { id: agentId, name: 'Agent', email: 'agent@test.com' },
    ]);

    // Collections = 500, Remittances = 500 → balance = 0
    mockPaymentAggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(500) },
    });
    mockRemittanceAggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(500) },
    });

    const result = await getAgentBalances();

    expect(result).toHaveLength(1);
    expect(Number(result[0].unremittedBalance)).toBe(0);
    expect(result[0].pending).toBe(false);
  });
});
