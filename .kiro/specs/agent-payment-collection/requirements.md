# Requirements Document

## Introduction

This feature introduces a two-tier payment collection flow for the milk delivery platform. Customers are assigned to a specific delivery agent who collects payments in the field. The admin/owner then collects the accumulated money from the delivery agent. The system tracks daily expected payments (what each agent should collect) versus received payments (what was actually collected), providing visibility into collection efficiency and outstanding amounts at both the customer and agent levels.

## Glossary

- **Agent_Payment_System**: The module responsible for managing the two-tier payment collection flow (Customer → Delivery Agent → Admin).
- **Delivery_Agent**: A user with the `delivery_agent` role who is assigned to customers for payment collection and delivery.
- **Customer_Agent_Assignment**: The association between a Customer and a Delivery_Agent responsible for collecting payments from that Customer.
- **Expected_Payment**: The total amount a Delivery_Agent is expected to collect from assigned customers on a given date, derived from outstanding invoices and ledger balances.
- **Received_Payment**: The total amount a Delivery_Agent has actually collected from customers on a given date.
- **Agent_Remittance**: A record of money transferred from a Delivery_Agent to the Admin/Owner.
- **Collection_Summary**: A daily report showing Expected_Payment versus Received_Payment per Delivery_Agent.
- **Admin**: A user with the `admin` or `super_admin` role who receives remittances from Delivery_Agents.

## Requirements

### Requirement 1: Customer-Agent Assignment

**User Story:** As an admin, I want to assign customers to a specific delivery agent for payment collection, so that each agent knows which customers to collect from and accountability is clear.

#### Acceptance Criteria

1. WHEN an admin assigns a Customer to a Delivery_Agent, THE Agent_Payment_System SHALL create a Customer_Agent_Assignment linking that Customer to the specified Delivery_Agent.
2. THE Agent_Payment_System SHALL enforce that each Customer has at most one active Customer_Agent_Assignment at any time.
3. WHEN an admin reassigns a Customer to a different Delivery_Agent, THE Agent_Payment_System SHALL replace the existing Customer_Agent_Assignment with the new assignment.
4. WHEN a Customer is assigned to a Delivery_Agent, THE Agent_Payment_System SHALL record the assignment date.
5. THE Agent_Payment_System SHALL allow admins to view all customers assigned to a specific Delivery_Agent.
6. THE Agent_Payment_System SHALL allow admins to view which Delivery_Agent is assigned to a specific Customer.
7. IF a referenced Customer or Delivery_Agent does not exist, THEN THE Agent_Payment_System SHALL return a descriptive error.

### Requirement 2: Agent Field Collection

**User Story:** As a delivery agent, I want to record payments collected from my assigned customers during delivery, so that the system tracks what I have collected.

#### Acceptance Criteria

1. WHEN a Delivery_Agent records a field collection, THE Agent_Payment_System SHALL create a Payment record with `isFieldCollection` set to true and `collectedBy` set to the Delivery_Agent identifier.
2. THE Agent_Payment_System SHALL only allow a Delivery_Agent to record collections for customers assigned to that Delivery_Agent.
3. WHEN a field collection is recorded, THE Agent_Payment_System SHALL create a corresponding LedgerEntry crediting the Customer account.
4. THE Agent_Payment_System SHALL accept the payment method (cash, upi, bank_transfer, card, other) for each field collection.
5. IF the specified Customer is not assigned to the requesting Delivery_Agent, THEN THE Agent_Payment_System SHALL reject the collection with a descriptive error.

### Requirement 3: Daily Expected Payment Calculation

**User Story:** As an admin, I want to see the total expected payment each delivery agent should collect daily, so that I can track collection targets.

#### Acceptance Criteria

1. WHEN an admin requests the daily Collection_Summary for a given date, THE Agent_Payment_System SHALL calculate the Expected_Payment for each Delivery_Agent by summing the outstanding balances of all customers assigned to that Delivery_Agent.
2. THE Agent_Payment_System SHALL derive Expected_Payment from the current ledger running balance (debit balance) of each assigned Customer.
3. THE Agent_Payment_System SHALL exclude customers with zero or negative (credit) balances from the Expected_Payment calculation.
4. THE Agent_Payment_System SHALL group Expected_Payment totals by Delivery_Agent.

### Requirement 4: Daily Received Payment Tracking

**User Story:** As an admin, I want to see the total amount each delivery agent has actually collected on a given day, so that I can compare it against the expected amount.

#### Acceptance Criteria

1. WHEN an admin requests the daily Collection_Summary for a given date, THE Agent_Payment_System SHALL calculate the Received_Payment for each Delivery_Agent by summing all field collections recorded by that Delivery_Agent on the specified date.
2. THE Agent_Payment_System SHALL include the count of collections made by each Delivery_Agent on the specified date.
3. THE Agent_Payment_System SHALL present Expected_Payment and Received_Payment side by side for each Delivery_Agent in the Collection_Summary.
4. THE Agent_Payment_System SHALL calculate the difference between Expected_Payment and Received_Payment for each Delivery_Agent.

### Requirement 5: Agent Remittance to Admin

**User Story:** As an admin, I want to record when a delivery agent hands over collected money to me, so that I can track the flow of funds from agent to admin.

#### Acceptance Criteria

1. WHEN an admin records an Agent_Remittance, THE Agent_Payment_System SHALL create a remittance record linking the Delivery_Agent, the remittance amount, the remittance date, and the Admin who received the funds.
2. THE Agent_Payment_System SHALL accept the payment method used for the remittance (cash, upi, bank_transfer, card, other).
3. THE Agent_Payment_System SHALL track the cumulative amount collected by a Delivery_Agent that has not yet been remitted to the Admin.
4. WHEN an Agent_Remittance is recorded, THE Agent_Payment_System SHALL reduce the un-remitted balance for that Delivery_Agent by the remittance amount.
5. IF the remittance amount exceeds the un-remitted balance for the Delivery_Agent, THEN THE Agent_Payment_System SHALL reject the remittance with a descriptive error.
6. THE Agent_Payment_System SHALL allow admins to view the remittance history for each Delivery_Agent.

### Requirement 6: Agent Collection Dashboard

**User Story:** As a delivery agent, I want to see my daily collection targets and what I have collected so far, so that I can track my progress during the day.

#### Acceptance Criteria

1. WHEN a Delivery_Agent views the collection dashboard, THE Agent_Payment_System SHALL display the list of assigned customers with their outstanding balances for the current date.
2. THE Agent_Payment_System SHALL display the total Expected_Payment for the Delivery_Agent for the current date.
3. THE Agent_Payment_System SHALL display the total Received_Payment recorded by the Delivery_Agent for the current date.
4. THE Agent_Payment_System SHALL display the remaining amount to be collected (Expected_Payment minus Received_Payment) for the current date.
5. THE Agent_Payment_System SHALL indicate which assigned customers have already made a payment on the current date.

### Requirement 7: Admin Collection Overview

**User Story:** As an admin, I want a consolidated view of all delivery agents' collection performance for a given date, so that I can monitor the overall payment collection status.

#### Acceptance Criteria

1. WHEN an admin views the collection overview for a given date, THE Agent_Payment_System SHALL display each Delivery_Agent with their Expected_Payment, Received_Payment, difference, and un-remitted balance.
2. THE Agent_Payment_System SHALL display the grand totals for Expected_Payment, Received_Payment, and un-remitted balance across all Delivery_Agents.
3. THE Agent_Payment_System SHALL allow the admin to filter the overview by a specific Delivery_Agent.
4. THE Agent_Payment_System SHALL allow the admin to filter the overview by date range.

### Requirement 8: Agent Balance Tracking

**User Story:** As an admin, I want to see how much money each delivery agent is currently holding (collected but not yet remitted), so that I can follow up on pending handovers.

#### Acceptance Criteria

1. THE Agent_Payment_System SHALL maintain a running un-remitted balance for each Delivery_Agent, calculated as total field collections minus total remittances.
2. WHEN an admin views the agent balances, THE Agent_Payment_System SHALL display each Delivery_Agent with their current un-remitted balance.
3. THE Agent_Payment_System SHALL sort Delivery_Agents by un-remitted balance in descending order by default.
4. IF a Delivery_Agent has an un-remitted balance greater than zero, THEN THE Agent_Payment_System SHALL flag that Delivery_Agent as having a pending remittance.
