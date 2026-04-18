import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockCustomerFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();
const mockAssignmentUpsert = vi.fn();
const mockAssignmentFindMany = vi.fn();
const mockAssignmentFindUnique = vi.fn();
const mockAssignmentDelete = vi.fn();
const mockAssignmentCount = vi.fn();

vi.mock('../../index.js', () => ({
  prisma: {
    customer: {
      findUnique: (...args: any[]) => mockCustomerFindUnique(...args),
    },
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
    },
    customerAgentAssignment: {
      upsert: (...args: any[]) => mockAssignmentUpsert(...args),
      findMany: (...args: any[]) => mockAssignmentFindMany(...args),
      findUnique: (...args: any[]) => mockAssignmentFindUnique(...args),
      delete: (...args: any[]) => mockAssignmentDelete(...args),
      count: (...args: any[]) => mockAssignmentCount(...args),
    },
  },
  redis: {},
}));

import {
  assignCustomer,
  getAssignmentsByAgent,
  getAssignmentByCustomer,
  removeAssignment,
  listAssignments,
} from './agent-assignments.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCustomer(id: string) {
  return { id, name: `Customer ${id.slice(0, 6)}`, phone: '9876543210', status: 'active' };
}

function makeAgent(id: string, role = 'delivery_agent') {
  return { id, name: `Agent ${id.slice(0, 6)}`, email: `agent-${id.slice(0, 6)}@test.com`, role };
}

function makeAssignment(customerId: string, agentId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `assign-${customerId.slice(0, 6)}`,
    customerId,
    agentId,
    assignedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { id: customerId, name: `Customer ${customerId.slice(0, 6)}`, phone: '9876543210' },
    agent: { id: agentId, name: `Agent ${agentId.slice(0, 6)}`, email: `agent@test.com` },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------
const uuidArb = fc.uuid();

// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 1: Assignment round-trip
// Validates: Requirements 1.1, 1.4, 1.5, 1.6
// ---------------------------------------------------------------------------
describe('Property 1: Assignment round-trip', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assign then query by customer returns that agent, query by agent includes that customer', async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, uuidArb, async (customerId, agentId) => {
        vi.clearAllMocks();

        const customer = makeCustomer(customerId);
        const agent = makeAgent(agentId);
        const assignment = makeAssignment(customerId, agentId);

        // Setup mocks for assignCustomer
        mockCustomerFindUnique.mockResolvedValue(customer);
        mockUserFindUnique.mockResolvedValue(agent);
        mockAssignmentUpsert.mockResolvedValue(assignment);

        // 1. Assign customer to agent
        const result = await assignCustomer({ customerId, agentId });

        expect(result.customerId).toBe(customerId);
        expect(result.agentId).toBe(agentId);
        expect(result.assignedAt).toBeInstanceOf(Date);

        // Verify upsert was called with correct customerId as unique key
        expect(mockAssignmentUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { customerId },
            create: expect.objectContaining({ customerId, agentId }),
            update: expect.objectContaining({ agentId }),
          }),
        );

        // 2. Query by customer — should return that agent
        vi.clearAllMocks();
        mockCustomerFindUnique.mockResolvedValue(customer);
        mockAssignmentFindUnique.mockResolvedValue(assignment);

        const byCustomer = await getAssignmentByCustomer(customerId);
        expect(byCustomer.agentId).toBe(agentId);
        expect(byCustomer.customer.id).toBe(customerId);

        // 3. Query by agent — should include that customer
        vi.clearAllMocks();
        mockUserFindUnique.mockResolvedValue(agent);
        mockAssignmentFindMany.mockResolvedValue([assignment]);

        const byAgent = await getAssignmentsByAgent(agentId);
        const found = byAgent.find((a: any) => a.customerId === customerId);
        expect(found).toBeDefined();
        expect(found!.agentId).toBe(agentId);
      }),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Feature: agent-payment-collection, Property 2: At most one assignment per customer
// Validates: Requirements 1.2, 1.3
// ---------------------------------------------------------------------------
describe('Property 2: At most one assignment per customer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reassigning a customer to different agents always results in exactly one assignment', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        fc.array(uuidArb, { minLength: 2, maxLength: 5 }),
        async (customerId, agentIds) => {
          const customer = makeCustomer(customerId);

          // Simulate a sequence of assignments for the same customer
          for (const agentId of agentIds) {
            vi.clearAllMocks();

            const agent = makeAgent(agentId);
            const assignment = makeAssignment(customerId, agentId);

            mockCustomerFindUnique.mockResolvedValue(customer);
            mockUserFindUnique.mockResolvedValue(agent);
            mockAssignmentUpsert.mockResolvedValue(assignment);

            const result = await assignCustomer({ customerId, agentId });

            // Each assignment should use upsert with customerId as unique key
            // ensuring only one assignment exists per customer
            expect(mockAssignmentUpsert).toHaveBeenCalledWith(
              expect.objectContaining({
                where: { customerId },
              }),
            );

            expect(result.customerId).toBe(customerId);
            expect(result.agentId).toBe(agentId);
          }

          // After all reassignments, query should return only the last agent
          vi.clearAllMocks();
          const lastAgentId = agentIds[agentIds.length - 1];
          const finalAssignment = makeAssignment(customerId, lastAgentId);

          mockCustomerFindUnique.mockResolvedValue(customer);
          mockAssignmentFindUnique.mockResolvedValue(finalAssignment);

          const byCustomer = await getAssignmentByCustomer(customerId);

          // Only one assignment — the last one
          expect(byCustomer.customerId).toBe(customerId);
          expect(byCustomer.agentId).toBe(lastAgentId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests: error cases
// ---------------------------------------------------------------------------
describe('assignCustomer — error cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NotFoundError when customer does not exist', async () => {
    mockCustomerFindUnique.mockResolvedValue(null);

    await expect(
      assignCustomer({ customerId: '00000000-0000-0000-0000-000000000001', agentId: '00000000-0000-0000-0000-000000000002' }),
    ).rejects.toThrow('Customer not found');
  });

  it('throws NotFoundError when agent does not exist', async () => {
    mockCustomerFindUnique.mockResolvedValue(makeCustomer('00000000-0000-0000-0000-000000000001'));
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      assignCustomer({ customerId: '00000000-0000-0000-0000-000000000001', agentId: '00000000-0000-0000-0000-000000000002' }),
    ).rejects.toThrow('Delivery agent not found');
  });

  it('throws ValidationError when user is not a delivery_agent', async () => {
    mockCustomerFindUnique.mockResolvedValue(makeCustomer('00000000-0000-0000-0000-000000000001'));
    mockUserFindUnique.mockResolvedValue(makeAgent('00000000-0000-0000-0000-000000000002', 'admin'));

    await expect(
      assignCustomer({ customerId: '00000000-0000-0000-0000-000000000001', agentId: '00000000-0000-0000-0000-000000000002' }),
    ).rejects.toThrow('User is not a delivery agent');
  });
});

describe('getAssignmentsByAgent — error cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NotFoundError when agent does not exist', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      getAssignmentsByAgent('00000000-0000-0000-0000-000000000099'),
    ).rejects.toThrow('Delivery agent not found');
  });
});

describe('getAssignmentByCustomer — error cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NotFoundError when customer does not exist', async () => {
    mockCustomerFindUnique.mockResolvedValue(null);

    await expect(
      getAssignmentByCustomer('00000000-0000-0000-0000-000000000099'),
    ).rejects.toThrow('Customer not found');
  });

  it('throws NotFoundError when no assignment exists for customer', async () => {
    mockCustomerFindUnique.mockResolvedValue(makeCustomer('00000000-0000-0000-0000-000000000001'));
    mockAssignmentFindUnique.mockResolvedValue(null);

    await expect(
      getAssignmentByCustomer('00000000-0000-0000-0000-000000000001'),
    ).rejects.toThrow('No agent assignment found for this customer');
  });
});

describe('removeAssignment — error cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NotFoundError when assignment does not exist', async () => {
    mockAssignmentFindUnique.mockResolvedValue(null);

    await expect(
      removeAssignment('00000000-0000-0000-0000-000000000099'),
    ).rejects.toThrow('Assignment not found');
  });
});
