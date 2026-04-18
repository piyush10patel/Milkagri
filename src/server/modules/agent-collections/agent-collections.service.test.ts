import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock createLedgerEntry
// ---------------------------------------------------------------------------
const mockCreateLedgerEntry = vi.fn();
vi.mock('../ledger/ledger.service.js', () => ({
  createLedgerEntry: (...args: any[]) => mockCreateLedgerEntry(...args),
}));

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockAssignmentFindUnique = vi.fn();
const mockAssignmentFindMany = vi.fn();
const mockPaymentCreate = vi.fn();
const mockPaymentFindFirst = vi.fn();
const mockPaymentAggregate = vi.fn();
const mockLedgerFindFirst = vi.fn();
const mockUserFindUnique = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    customerAgentAssignment: {
      findUnique: (...args: any[]) => mockAssignmentFindUnique(...args),
      findMany: (...args: any[]) => mockAssignmentFindMany(...args),
    },
    payment: {
      create: (...args: any[]) => mockPaymentCreate(...args),
      findFirst: (...args: any[]) => mockPaymentFindFirst(...args),
      aggregate: (...args: any[]) => mockPaymentAggregate(...args),
    },
    ledgerEntry: {
      findFirst: (...args: any[]) => mockLedgerFindFirst(...args),
    },
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
  redis: {},
}));

import {
  recordAgentCollection,
  getDailyCollectionSummary,
  getAgentDashboard,
} from './agent-collections.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAssignment(customerId: string, agentId: string) {
  return {
    id: `assign-${customerId.slice(0, 8)}`,
    customerId,
    agentId,
    assignedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makePayment(
  customerId: string,
  agentId: string,
  amount: number,
  paymentMethod: string,
  paymentDate: string,
) {
  return {
    id: `pay-${customerId.slice(0, 8)}`,
    customerId,
    amount: new Prisma.Decimal(amount),
    paymentMethod,
    paymentDate: new Date(paymentDate + 'T00:00:00.000Z'),
    collectedBy: agentId,
    isFieldCollection: true,
    recordedBy: agentId,
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------
const uuidArb = fc.uuid();
const positiveAmountArb = fc.double({ min: 0.01, max: 99999, noNaN: true }).map((n) =>
  Math.round(n * 100) / 100,
);
const paymentMethodArb = fc.constantFrom('cash', 'upi', 'bank_transfer', 'card', 'other');
const dateStrArb = fc
  .integer({ min: 0, max: 730 })
  .map((offset) => {
    const d = new Date(2024, 0, 1 + offset);
    return d.toISOString().slice(0, 10);
  });

// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 3: Field collection creates correct Payment and LedgerEntry
// Validates: Requirements 2.1, 2.3, 2.4
// ---------------------------------------------------------------------------
describe('Property 3: Field collection creates correct Payment and LedgerEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recording a collection creates Payment with isFieldCollection=true, collectedBy=agentId, and a LedgerEntry with correct creditAmount', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        positiveAmountArb,
        paymentMethodArb,
        dateStrArb,
        async (customerId, agentId, amount, paymentMethod, paymentDate) => {
          vi.clearAllMocks();

          const assignment = makeAssignment(customerId, agentId);
          mockAssignmentFindUnique.mockResolvedValue(assignment);

          const expectedPayment = makePayment(customerId, agentId, amount, paymentMethod, paymentDate);

          // The service calls prisma.$transaction with a callback
          mockTransaction.mockImplementation(async (cb: Function) => {
            // Provide a tx object with payment.create
            const tx = {
              payment: { create: mockPaymentCreate },
              ledgerEntry: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
            };
            mockPaymentCreate.mockResolvedValue(expectedPayment);
            mockCreateLedgerEntry.mockResolvedValue({});
            return cb(tx);
          });

          const result = await recordAgentCollection(
            { customerId, amount, paymentMethod: paymentMethod as any, paymentDate },
            agentId,
          );

          // Payment should have isFieldCollection=true and collectedBy=agentId
          expect(result.isFieldCollection).toBe(true);
          expect(result.collectedBy).toBe(agentId);
          expect(result.customerId).toBe(customerId);
          expect(result.paymentMethod).toBe(paymentMethod);

          // Verify payment.create was called with correct fields
          expect(mockPaymentCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                customerId,
                isFieldCollection: true,
                collectedBy: agentId,
                paymentMethod,
              }),
            }),
          );

          // Verify createLedgerEntry was called with creditAmount = amount
          expect(mockCreateLedgerEntry).toHaveBeenCalledWith(
            expect.anything(), // tx
            expect.objectContaining({
              customerId,
              creditAmount: new Prisma.Decimal(amount),
              debitAmount: new Prisma.Decimal(0),
              transactionType: 'payment',
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 4: Assignment enforcement on field collection
// Validates: Requirements 2.2, 2.5
// ---------------------------------------------------------------------------
describe('Property 4: Assignment enforcement on field collection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('collection is rejected when customer is not assigned to the requesting agent', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        positiveAmountArb,
        paymentMethodArb,
        dateStrArb,
        async (customerId, agentId, otherAgentId, amount, paymentMethod, paymentDate) => {
          // Ensure the two agents are different
          fc.pre(agentId !== otherAgentId);
          vi.clearAllMocks();

          // Customer is assigned to otherAgentId, not agentId
          const assignment = makeAssignment(customerId, otherAgentId);
          mockAssignmentFindUnique.mockResolvedValue(assignment);

          await expect(
            recordAgentCollection(
              { customerId, amount, paymentMethod: paymentMethod as any, paymentDate },
              agentId,
            ),
          ).rejects.toThrow('Customer is not assigned to you');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('collection succeeds when customer is assigned to the requesting agent', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        positiveAmountArb,
        paymentMethodArb,
        dateStrArb,
        async (customerId, agentId, amount, paymentMethod, paymentDate) => {
          vi.clearAllMocks();

          const assignment = makeAssignment(customerId, agentId);
          mockAssignmentFindUnique.mockResolvedValue(assignment);

          const expectedPayment = makePayment(customerId, agentId, amount, paymentMethod, paymentDate);

          mockTransaction.mockImplementation(async (cb: Function) => {
            const tx = {
              payment: { create: mockPaymentCreate },
              ledgerEntry: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
            };
            mockPaymentCreate.mockResolvedValue(expectedPayment);
            mockCreateLedgerEntry.mockResolvedValue({});
            return cb(tx);
          });

          const result = await recordAgentCollection(
            { customerId, amount, paymentMethod: paymentMethod as any, paymentDate },
            agentId,
          );

          expect(result.customerId).toBe(customerId);
          expect(result.collectedBy).toBe(agentId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 5: Expected payment calculation
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
// ---------------------------------------------------------------------------
describe('Property 5: Expected payment calculation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('expected payment equals sum of positive running balances of assigned customers', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        fc.array(
          fc.record({
            customerId: uuidArb,
            balance: fc.double({ min: -1000, max: 10000, noNaN: true }).map(
              (n) => Math.round(n * 100) / 100,
            ),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        dateStrArb,
        async (agentId, customerBalances, date) => {
          vi.clearAllMocks();

          // Build assignments for this agent
          const assignments = customerBalances.map((cb) => ({
            ...makeAssignment(cb.customerId, agentId),
            agent: { id: agentId, name: 'Agent', email: 'agent@test.com' },
          }));

          mockAssignmentFindMany.mockResolvedValue(assignments);

          // Mock ledger balance for each customer
          let callIndex = 0;
          mockLedgerFindFirst.mockImplementation(async () => {
            const balance = customerBalances[callIndex]?.balance ?? 0;
            callIndex++;
            return { runningBalance: new Prisma.Decimal(balance) };
          });

          // Mock received payments (zero for this test — we only care about expected)
          mockPaymentAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(0) },
            _count: { id: 0 },
          });

          const result = await getDailyCollectionSummary({ date });

          // Calculate expected sum of positive balances
          const expectedSum = customerBalances.reduce((sum, cb) => {
            return cb.balance > 0 ? sum + cb.balance : sum;
          }, 0);

          expect(result.length).toBe(1);
          expect(Number(result[0].expected)).toBeCloseTo(expectedSum, 1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 6: Received payment calculation
// Validates: Requirements 4.1, 4.2
// ---------------------------------------------------------------------------
describe('Property 6: Received payment calculation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('received payment equals sum of field collections and count matches number of collections', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        fc.array(uuidArb, { minLength: 1, maxLength: 5 }),
        fc.array(positiveAmountArb, { minLength: 1, maxLength: 5 }),
        dateStrArb,
        async (agentId, customerIds, amounts, date) => {
          vi.clearAllMocks();

          // Use the shorter array length
          const count = Math.min(customerIds.length, amounts.length);
          const usedAmounts = amounts.slice(0, count);
          const usedCustomerIds = customerIds.slice(0, count);

          const totalReceived = usedAmounts.reduce((s, a) => s + a, 0);

          // Build assignments
          const assignments = usedCustomerIds.map((cid) => ({
            ...makeAssignment(cid, agentId),
            agent: { id: agentId, name: 'Agent', email: 'agent@test.com' },
          }));

          mockAssignmentFindMany.mockResolvedValue(assignments);

          // Mock ledger balances (all zero — we only care about received)
          mockLedgerFindFirst.mockResolvedValue({ runningBalance: new Prisma.Decimal(0) });

          // Mock received aggregate
          mockPaymentAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(totalReceived) },
            _count: { id: count },
          });

          const result = await getDailyCollectionSummary({ date });

          expect(result.length).toBe(1);
          expect(Number(result[0].received)).toBeCloseTo(totalReceived, 1);
          expect(result[0].collectionCount).toBe(count);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 7: Collection summary difference
// Validates: Requirements 4.4
// ---------------------------------------------------------------------------
describe('Property 7: Collection summary difference', () => {
  beforeEach(() => vi.clearAllMocks());

  it('difference equals expected minus received for each agent', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        positiveAmountArb,
        positiveAmountArb,
        dateStrArb,
        async (agentId, expectedAmount, receivedAmount, date) => {
          vi.clearAllMocks();

          // One agent with one customer
          const customerId = '00000000-0000-0000-0000-000000000001';
          const assignments = [
            {
              ...makeAssignment(customerId, agentId),
              agent: { id: agentId, name: 'Agent', email: 'agent@test.com' },
            },
          ];

          mockAssignmentFindMany.mockResolvedValue(assignments);

          // Mock ledger balance = expectedAmount (positive)
          mockLedgerFindFirst.mockResolvedValue({
            runningBalance: new Prisma.Decimal(expectedAmount),
          });

          // Mock received
          mockPaymentAggregate.mockResolvedValue({
            _sum: { amount: new Prisma.Decimal(receivedAmount) },
            _count: { id: 1 },
          });

          const result = await getDailyCollectionSummary({ date });

          expect(result.length).toBe(1);
          const diff = expectedAmount - receivedAmount;
          expect(Number(result[0].difference)).toBeCloseTo(diff, 1);
          expect(Number(result[0].expected) - Number(result[0].received)).toBeCloseTo(
            Number(result[0].difference),
            1,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 11: Agent dashboard paid-customer indicator
// Validates: Requirements 6.5
// ---------------------------------------------------------------------------
describe('Property 11: Agent dashboard paid-customer indicator', () => {
  beforeEach(() => vi.clearAllMocks());

  it('customer is marked paid iff there exists a field collection for that customer on that date', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        fc.boolean(),
        dateStrArb,
        async (agentId, customerId, hasPaid, date) => {
          vi.clearAllMocks();

          mockUserFindUnique.mockResolvedValue({
            id: agentId,
            name: 'Agent',
            email: 'agent@test.com',
            role: 'delivery_agent',
          });

          mockAssignmentFindMany.mockResolvedValue([
            {
              ...makeAssignment(customerId, agentId),
              customer: { id: customerId, name: 'Customer', phone: '9876543210' },
            },
          ]);

          // Mock ledger balance
          mockLedgerFindFirst.mockResolvedValue({
            runningBalance: new Prisma.Decimal(100),
          });

          // Mock payment lookup — if hasPaid, return a payment; otherwise null
          if (hasPaid) {
            mockPaymentFindFirst.mockResolvedValue({
              id: 'pay-1',
              amount: new Prisma.Decimal(50),
            });
            mockPaymentAggregate.mockResolvedValue({
              _sum: { amount: new Prisma.Decimal(50) },
            });
          } else {
            mockPaymentFindFirst.mockResolvedValue(null);
          }

          const result = await getAgentDashboard(agentId, { date });

          expect(result.customers.length).toBe(1);
          expect(result.customers[0].paid).toBe(hasPaid);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests: error cases and edge cases
// ---------------------------------------------------------------------------
describe('recordAgentCollection — error cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws ForbiddenError when customer has no assignment (invalid customer)', async () => {
    mockAssignmentFindUnique.mockResolvedValue(null);

    await expect(
      recordAgentCollection(
        {
          customerId: '00000000-0000-0000-0000-000000000001',
          amount: 100,
          paymentMethod: 'cash',
          paymentDate: '2025-01-15',
        },
        '00000000-0000-0000-0000-000000000099',
      ),
    ).rejects.toThrow('Customer is not assigned to you');
  });

  it('throws ForbiddenError when customer is assigned to a different agent (unassigned customer)', async () => {
    mockAssignmentFindUnique.mockResolvedValue(
      makeAssignment(
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
      ),
    );

    await expect(
      recordAgentCollection(
        {
          customerId: '00000000-0000-0000-0000-000000000001',
          amount: 100,
          paymentMethod: 'cash',
          paymentDate: '2025-01-15',
        },
        '00000000-0000-0000-0000-000000000099', // different agent
      ),
    ).rejects.toThrow('Customer is not assigned to you');
  });
});

describe('getDailyCollectionSummary — edge cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when no agents have assignments', async () => {
    mockAssignmentFindMany.mockResolvedValue([]);

    const result = await getDailyCollectionSummary({ date: '2025-01-15' });

    expect(result).toEqual([]);
  });
});
