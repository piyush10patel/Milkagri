# Design Document: Agent Payment Collection

## Overview

This feature implements a two-tier payment collection flow: Customer → Delivery Agent → Admin. It adds customer-agent assignment, agent field collection with assignment enforcement, daily expected vs received payment tracking, agent remittance recording, and dashboards for both agents and admins.

The system builds on the existing `Payment`, `LedgerEntry`, and `User` models. A new `CustomerAgentAssignment` model links customers to agents, and a new `AgentRemittance` model tracks money handover from agents to admin. The existing `Payment.isFieldCollection` and `Payment.collectedBy` fields are already in place and will be leveraged for field collection tracking.

### Key Design Decisions

1. **Single active assignment constraint**: Each customer has at most one active agent assignment, enforced via a unique constraint on `customerId` in the assignment table.
2. **Un-remitted balance is computed, not stored**: Agent un-remitted balance is calculated as `SUM(field collections by agent) - SUM(remittances by agent)` rather than maintaining a denormalized column. This avoids drift and keeps the ledger as the source of truth.
3. **Expected payment derived from ledger**: Expected payment per agent is the sum of positive running balances of assigned customers, pulled from the ledger's latest entry per customer.
4. **Reuse existing Payment model**: Field collections continue to use the existing `Payment` table with `isFieldCollection=true` and `collectedBy` set to the agent. No new payment table needed.

## Architecture

```mermaid
graph TD
    subgraph Frontend
        ACD[Agent Collection Dashboard]
        ACO[Admin Collection Overview]
        AAM[Admin Assignment Management]
    end

    subgraph API Layer
        ACR[/api/agent-collections/*]
        AAR[/api/agent-assignments/*]
        ARR[/api/agent-remittances/*]
    end

    subgraph Service Layer
        ACS[agentCollections.service]
        AAS[agentAssignments.service]
        ARS[agentRemittances.service]
    end

    subgraph Data Layer
        CAA[(CustomerAgentAssignment)]
        PAY[(Payment)]
        LED[(LedgerEntry)]
        REM[(AgentRemittance)]
    end

    ACD --> ACR
    ACO --> ACR
    ACO --> ARR
    AAM --> AAR

    ACR --> ACS
    AAR --> AAS
    ARR --> ARS

    ACS --> PAY
    ACS --> LED
    ACS --> CAA
    AAS --> CAA
    ARS --> REM
    ARS --> PAY
```

## Components and Interfaces

### 1. Agent Assignments Module (`src/server/modules/agent-assignments/`)

Manages customer-to-agent linking.

**API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/agent-assignments` | admin | Assign/reassign customer to agent |
| GET | `/api/agent-assignments` | admin | List all assignments (filterable by agentId) |
| GET | `/api/agent-assignments/agent/:agentId` | admin, agent(self) | Get customers assigned to an agent |
| GET | `/api/agent-assignments/customer/:customerId` | admin | Get agent assigned to a customer |
| DELETE | `/api/agent-assignments/:id` | admin | Remove an assignment |

**Service Functions:**
- `assignCustomer(customerId, agentId)` — Creates or replaces assignment (upsert on customerId)
- `getAssignmentsByAgent(agentId)` — Returns all customers assigned to an agent
- `getAssignmentByCustomer(customerId)` — Returns the agent assigned to a customer
- `removeAssignment(assignmentId)` — Deletes an assignment
- `listAssignments(query)` — Paginated list with optional agentId filter

### 2. Agent Collections Module (`src/server/modules/agent-collections/`)

Handles agent field collection recording and daily summary calculations.

**API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/agent-collections` | agent | Record a field collection |
| GET | `/api/agent-collections/summary` | admin | Daily collection summary (expected vs received per agent) |
| GET | `/api/agent-collections/dashboard` | agent | Agent's own dashboard for current date |

**Service Functions:**
- `recordAgentCollection(input, agentUserId)` — Validates assignment, creates Payment + LedgerEntry
- `getDailyCollectionSummary(date)` — Calculates expected & received per agent for a date
- `getAgentDashboard(agentId, date)` — Returns assigned customers, balances, and collection status

### 3. Agent Remittances Module (`src/server/modules/agent-remittances/`)

Records money handover from agent to admin.

**API Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/agent-remittances` | admin | Record a remittance |
| GET | `/api/agent-remittances` | admin | List remittances (filterable by agentId, date range) |
| GET | `/api/agent-remittances/balances` | admin | Get un-remitted balances for all agents |

**Service Functions:**
- `recordRemittance(input, adminUserId)` — Validates un-remitted balance, creates remittance record
- `listRemittances(query)` — Paginated list with filters
- `getAgentBalances()` — Returns un-remitted balance per agent, sorted descending
- `getUnremittedBalance(agentId)` — Calculates single agent's un-remitted balance

### 4. Frontend Pages

| Page | Path | Role | Description |
|------|------|------|-------------|
| AgentCollectionDashboard | `/collections/dashboard` | agent | Agent's daily collection view |
| AdminCollectionOverview | `/collections/overview` | admin | Admin consolidated view |
| AgentAssignmentPage | `/collections/assignments` | admin | Manage customer-agent assignments |
| AgentRemittancePage | `/collections/remittances` | admin | Record and view remittances |
| AgentBalancesPage | `/collections/balances` | admin | View un-remitted balances |

## Data Models

### New Models

```prisma
model CustomerAgentAssignment {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  customerId String   @unique @map("customer_id") @db.Uuid
  agentId    String   @map("agent_id") @db.Uuid
  assignedAt DateTime @default(now()) @map("assigned_at") @db.Timestamptz
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  customer Customer @relation(fields: [customerId], references: [id])
  agent    User     @relation("AgentAssignments", fields: [agentId], references: [id])

  @@index([agentId], map: "idx_customer_agent_assignments_agent")
  @@map("customer_agent_assignments")
}

model AgentRemittance {
  id              String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  agentId         String        @map("agent_id") @db.Uuid
  amount          Decimal       @db.Decimal(12, 2)
  paymentMethod   PaymentMethod @map("payment_method")
  remittanceDate  DateTime      @map("remittance_date") @db.Date
  notes           String?       @db.Text
  receivedBy      String        @map("received_by") @db.Uuid
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz

  agent    User @relation("AgentRemittances", fields: [agentId], references: [id])
  receiver User @relation("RemittanceReceiver", fields: [receivedBy], references: [id])

  @@index([agentId], map: "idx_agent_remittances_agent")
  @@index([remittanceDate], map: "idx_agent_remittances_date")
  @@map("agent_remittances")
}
```

### Relation Additions to Existing Models

**User model** — add:
```
agentAssignments       CustomerAgentAssignment[] @relation("AgentAssignments")
agentRemittances       AgentRemittance[]         @relation("AgentRemittances")
receivedRemittances    AgentRemittance[]         @relation("RemittanceReceiver")
```

**Customer model** — add:
```
agentAssignment CustomerAgentAssignment?
```

### Key Computed Values (not stored)

- **Expected Payment (per agent, per date)**: `SUM(runningBalance)` from latest `LedgerEntry` per assigned customer where `runningBalance > 0`
- **Received Payment (per agent, per date)**: `SUM(amount)` from `Payment` where `isFieldCollection=true AND collectedBy=agentId AND paymentDate=date`
- **Un-remitted Balance (per agent)**: `SUM(Payment.amount) WHERE isFieldCollection=true AND collectedBy=agentId` minus `SUM(AgentRemittance.amount) WHERE agentId=agentId`



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Assignment round-trip

*For any* customer and any delivery agent, assigning the customer to the agent and then querying by customer should return that agent, and querying by agent should include that customer. The assignment record must include a valid `assignedAt` timestamp.

**Validates: Requirements 1.1, 1.4, 1.5, 1.6**

### Property 2: At most one assignment per customer

*For any* customer and any sequence of agent assignments, the customer should have exactly one active assignment at any time. Reassigning to a different agent should replace the previous assignment, not create a second one.

**Validates: Requirements 1.2, 1.3**

### Property 3: Field collection creates correct Payment and LedgerEntry

*For any* valid field collection input (valid customer, valid agent, valid payment method, positive amount), recording the collection should create a Payment with `isFieldCollection=true` and `collectedBy=agentId`, and a corresponding LedgerEntry with `creditAmount` equal to the payment amount.

**Validates: Requirements 2.1, 2.3, 2.4**

### Property 4: Assignment enforcement on field collection

*For any* delivery agent and any customer not assigned to that agent, attempting to record a field collection should be rejected with an error. Conversely, for any assigned customer, the collection should succeed.

**Validates: Requirements 2.2, 2.5**

### Property 5: Expected payment calculation

*For any* set of customer-agent assignments and customer ledger balances, the expected payment for an agent on a given date should equal the sum of positive running balances (from the latest ledger entry) of all customers assigned to that agent. Customers with zero or negative balances should be excluded.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 6: Received payment calculation

*For any* set of field collections by an agent on a given date, the received payment should equal the sum of all those collection amounts, and the collection count should equal the number of collections.

**Validates: Requirements 4.1, 4.2**

### Property 7: Collection summary difference

*For any* agent in a daily collection summary, the difference field should equal the expected payment minus the received payment for that agent.

**Validates: Requirements 4.4**

### Property 8: Remittance record creation

*For any* valid remittance input (valid agent, positive amount not exceeding un-remitted balance, valid payment method, valid date), recording the remittance should create a record containing the agent, amount, date, payment method, and the admin who received the funds.

**Validates: Requirements 5.1, 5.2**

### Property 9: Un-remitted balance invariant

*For any* delivery agent, the un-remitted balance should equal the total of all field collections by that agent minus the total of all remittances by that agent. Recording a new remittance of amount X should reduce the un-remitted balance by exactly X.

**Validates: Requirements 5.3, 5.4, 8.1, 8.2**

### Property 10: Remittance rejection on overpayment

*For any* delivery agent and any remittance amount that exceeds the agent's current un-remitted balance, the system should reject the remittance with an error.

**Validates: Requirements 5.5**

### Property 11: Agent dashboard paid-customer indicator

*For any* agent and date, the dashboard should mark each assigned customer as "paid" if and only if there exists at least one field collection for that customer by that agent on that date.

**Validates: Requirements 6.5**

### Property 12: Grand totals consistency

*For any* admin collection overview, the grand totals for expected payment, received payment, and un-remitted balance should each equal the sum of the respective per-agent values.

**Validates: Requirements 7.2**

### Property 13: Agent balances ordering and flagging

*For any* set of agents with un-remitted balances, the balances list should be sorted in descending order by balance amount. Each agent with a balance greater than zero should be flagged as having a pending remittance, and agents with zero balance should not be flagged.

**Validates: Requirements 8.3, 8.4**

## Error Handling

| Scenario | Error Type | HTTP Status | Message |
|----------|-----------|-------------|---------|
| Customer not found during assignment | NotFoundError | 404 | "Customer not found" |
| Agent not found during assignment | NotFoundError | 404 | "Delivery agent not found" |
| User is not a delivery_agent role | ValidationError | 400 | "User is not a delivery agent" |
| Customer not assigned to agent during collection | ForbiddenError | 403 | "Customer is not assigned to you" |
| Remittance exceeds un-remitted balance | ValidationError | 400 | "Remittance amount exceeds un-remitted balance" |
| Invalid payment method | ValidationError | 400 | Zod validation error |
| Invalid date format | ValidationError | 400 | Zod validation error |
| Non-positive amount | ValidationError | 400 | "Amount must be positive" |

All errors follow the existing `AppError` hierarchy from `src/server/lib/errors.ts`. Validation is handled via Zod schemas through the existing `validate` middleware.

## Testing Strategy

### Unit Tests

Unit tests cover specific examples, edge cases, and error conditions:

- Assignment with non-existent customer/agent returns 404
- Reassignment replaces previous assignment (specific example)
- Collection by unassigned agent returns 403
- Remittance exceeding balance returns 400
- Expected payment excludes zero/negative balance customers (edge case)
- Empty assignment list returns empty summary
- Dashboard with no collections shows zero received

### Property-Based Tests

Property tests use `fast-check` (already available in the project ecosystem) to verify universal properties across randomized inputs. Each property test must:

- Run a minimum of 100 iterations
- Reference its design document property via a comment tag
- Tag format: **Feature: agent-payment-collection, Property {number}: {property_text}**

Properties to implement as PBT:

1. **Property 1**: Assignment round-trip — generate random customer/agent pairs, assign, query both directions
2. **Property 2**: Single assignment invariant — generate sequences of assignments for one customer, verify count is always 1
3. **Property 3**: Field collection output correctness — generate valid collection inputs, verify Payment + LedgerEntry fields
4. **Property 4**: Assignment enforcement — generate assigned and unassigned pairs, verify accept/reject
5. **Property 5**: Expected payment sum — generate customer balances and assignments, verify sum of positive balances
6. **Property 6**: Received payment sum — generate collections for a date, verify sum and count
7. **Property 7**: Difference calculation — generate expected and received values, verify difference
8. **Property 9**: Un-remitted balance — generate collections and remittances, verify balance = collections - remittances
9. **Property 10**: Overpayment rejection — generate amounts exceeding balance, verify rejection
10. **Property 13**: Ordering and flagging — generate agent balances, verify descending sort and correct flags

Properties 8, 11, and 12 are best covered by unit tests with specific examples since they test API response shape and boolean indicators rather than computational invariants.
