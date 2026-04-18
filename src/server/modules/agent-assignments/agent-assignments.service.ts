import { prisma } from '../../index.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import type { Prisma } from '@prisma/client';
import type { AssignCustomerInput, ListAssignmentsQuery } from './agent-assignments.types.js';

// Shared include for assignment queries
const assignmentInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  agent: { select: { id: true, name: true, email: true } },
} satisfies Prisma.CustomerAgentAssignmentInclude;

// ---------------------------------------------------------------------------
// Assign customer to agent (upsert — Req 1.1, 1.2, 1.3)
// ---------------------------------------------------------------------------
export async function assignCustomer(input: AssignCustomerInput) {
  const { customerId, agentId } = input;

  // Validate customer exists
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  // Validate agent exists
  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent) {
    throw new NotFoundError('Delivery agent not found');
  }

  // Verify agent has delivery_agent role
  if (agent.role !== 'delivery_agent') {
    throw new ValidationError('User is not a delivery agent');
  }

  // Upsert — unique on customerId ensures at most one assignment per customer
  return prisma.customerAgentAssignment.upsert({
    where: { customerId },
    create: {
      customerId,
      agentId,
      assignedAt: new Date(),
    },
    update: {
      agentId,
      assignedAt: new Date(),
    },
    include: assignmentInclude,
  });
}


// ---------------------------------------------------------------------------
// Get all assignments for an agent (Req 1.5)
// ---------------------------------------------------------------------------
export async function getAssignmentsByAgent(agentId: string) {
  const agent = await prisma.user.findUnique({ where: { id: agentId } });
  if (!agent) {
    throw new NotFoundError('Delivery agent not found');
  }

  return prisma.customerAgentAssignment.findMany({
    where: { agentId },
    include: assignmentInclude,
    orderBy: { assignedAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Get assignment for a customer (Req 1.6)
// ---------------------------------------------------------------------------
export async function getAssignmentByCustomer(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  const assignment = await prisma.customerAgentAssignment.findUnique({
    where: { customerId },
    include: assignmentInclude,
  });

  if (!assignment) {
    throw new NotFoundError('No agent assignment found for this customer');
  }

  return assignment;
}

// ---------------------------------------------------------------------------
// Remove assignment (Req 1.1)
// ---------------------------------------------------------------------------
export async function removeAssignment(assignmentId: string) {
  const assignment = await prisma.customerAgentAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) {
    throw new NotFoundError('Assignment not found');
  }

  return prisma.customerAgentAssignment.delete({
    where: { id: assignmentId },
  });
}

// ---------------------------------------------------------------------------
// List assignments — paginated with optional agentId filter (Req 1.5, 1.7)
// ---------------------------------------------------------------------------
export async function listAssignments(query: ListAssignmentsQuery) {
  const { agentId, page, limit } = query;
  const pagination = parsePagination(page, limit);

  const where: Prisma.CustomerAgentAssignmentWhereInput = {};
  if (agentId) {
    where.agentId = agentId;
  }

  const [items, total] = await Promise.all([
    prisma.customerAgentAssignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: { assignedAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.customerAgentAssignment.count({ where }),
  ]);

  return paginatedResponse(items, total, pagination);
}
