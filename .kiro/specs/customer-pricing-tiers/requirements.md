# Requirements Document

## Introduction

This feature introduces per-customer pricing differentiation and configurable billing frequency to the milk delivery platform. Currently, product prices are resolved globally by variant, date, and optional branch. This feature adds three pricing categories ("Cat 1", "Cat 2", "Cat 3") that can be assigned to each customer, with product variant prices varying per category. Additionally, the billing system currently supports only monthly invoicing. This feature extends it to support per-customer billing frequencies: daily, every 2 days, weekly, every 10 days, and monthly.

## Glossary

- **Platform**: The milk delivery management application (server and client)
- **Pricing_Category**: One of three customer price tiers — "Cat 1", "Cat 2", or "Cat 3" — that determines which product variant prices apply to a customer
- **Billing_Frequency**: The interval at which invoices are generated for a customer. One of: daily, every_2_days, weekly, every_10_days, monthly
- **Price_Resolver**: The server-side function (`getEffectivePrice`) that determines the applicable unit price for a product variant on a given date
- **Invoice_Generator**: The billing job and service responsible for creating invoices for a billing cycle
- **Customer_Form**: The UI page used by administrators to create or edit customer records
- **Product_Price_Form**: The UI page used by administrators to manage product variant prices
- **Customer**: A recipient of milk deliveries who has subscriptions, orders, and invoices

## Requirements

### Requirement 1: Assign Pricing Category to Customer

**User Story:** As an administrator, I want to assign a pricing category to each customer, so that the platform charges them the correct tier-specific prices.

#### Acceptance Criteria

1. THE Platform SHALL store a `pricingCategory` field on each Customer record with allowed values "Cat 1", "Cat 2", and "Cat 3"
2. WHEN a new Customer is created without specifying a pricing category, THE Platform SHALL default the pricing category to "Cat 1"
3. WHEN an administrator updates a Customer's pricing category, THE Platform SHALL persist the new category and apply it to all future price lookups for that Customer
4. THE Customer_Form SHALL display a pricing category selector with options "Cat 1", "Cat 2", and "Cat 3"
5. THE Platform SHALL validate that the pricing category value is one of the three allowed values before persisting a Customer record

### Requirement 2: Category-Specific Product Variant Pricing

**User Story:** As an administrator, I want to set different prices per pricing category for each product variant, so that customers in different tiers pay different rates.

#### Acceptance Criteria

1. THE Platform SHALL store product variant prices with an associated pricing category, extending the existing ProductPrice model
2. THE Platform SHALL enforce a unique constraint on the combination of product variant, effective date, branch, and pricing category
3. WHEN an administrator creates or edits product variant prices, THE Product_Price_Form SHALL allow specifying a pricing category for each price entry
4. THE Product_Price_Form SHALL display price inputs for all three pricing categories when managing variant prices
5. IF a price entry is submitted without a valid pricing category, THEN THE Platform SHALL reject the entry with a descriptive validation error

### Requirement 3: Price Resolution by Customer Category

**User Story:** As a billing operator, I want the platform to automatically resolve the correct price based on a customer's pricing category, so that invoices reflect tier-specific pricing.

#### Acceptance Criteria

1. WHEN resolving a price for a delivery order, THE Price_Resolver SHALL look up the most recent price where effective_date is on or before the target date, matching the customer's pricing category, product variant, and optional branch
2. IF no category-specific price exists for the customer's pricing category, THEN THE Price_Resolver SHALL fall back to a price with no pricing category (null category) for the same variant, date, and branch
3. THE Price_Resolver SHALL accept a pricing category parameter in addition to the existing variant, date, and branch parameters
4. WHEN the Invoice_Generator calculates line item unit prices, THE Invoice_Generator SHALL pass the customer's pricing category to the Price_Resolver
5. FOR ALL valid product variant and pricing category combinations, resolving a price and then looking up the same variant, date, branch, and category SHALL return an equivalent price record (round-trip consistency)

### Requirement 4: Assign Billing Frequency to Customer

**User Story:** As an administrator, I want to configure how often each customer is billed, so that invoicing aligns with individual payment arrangements.

#### Acceptance Criteria

1. THE Platform SHALL store a `billingFrequency` field on each Customer record with allowed values: "daily", "every_2_days", "weekly", "every_10_days", "monthly"
2. WHEN a new Customer is created without specifying a billing frequency, THE Platform SHALL default the billing frequency to "monthly"
3. WHEN an administrator updates a Customer's billing frequency, THE Platform SHALL persist the new frequency and use it for all future invoice generation for that Customer
4. THE Customer_Form SHALL display a billing frequency selector with options: Daily, Every 2 Days, Weekly, Every 10 Days, Monthly
5. THE Platform SHALL validate that the billing frequency value is one of the five allowed values before persisting a Customer record

### Requirement 5: Flexible Invoice Generation by Billing Frequency

**User Story:** As a billing operator, I want invoices to be generated according to each customer's billing frequency, so that customers receive invoices on their configured schedule.

#### Acceptance Criteria

1. THE Invoice_Generator SHALL calculate billing cycle start and end dates based on each customer's billing frequency
2. WHEN the billing job runs, THE Invoice_Generator SHALL identify all customers whose current billing cycle has ended and generate invoices for those customers
3. WHEN a customer has billing frequency "daily", THE Invoice_Generator SHALL create an invoice covering a single day
4. WHEN a customer has billing frequency "every_2_days", THE Invoice_Generator SHALL create an invoice covering a 2-day period
5. WHEN a customer has billing frequency "weekly", THE Invoice_Generator SHALL create an invoice covering a 7-day period
6. WHEN a customer has billing frequency "every_10_days", THE Invoice_Generator SHALL create an invoice covering a 10-day period
7. WHEN a customer has billing frequency "monthly", THE Invoice_Generator SHALL create an invoice covering the calendar month (first day to last day)
8. THE Invoice_Generator SHALL carry forward the closing balance from the customer's most recent prior invoice as the opening balance of the new invoice

### Requirement 6: Billing Job Scheduling

**User Story:** As a system operator, I want the billing job to run daily and process all customers whose billing cycles have completed, so that invoices are generated on time regardless of frequency.

#### Acceptance Criteria

1. THE Platform SHALL run the invoice generation job daily instead of only monthly
2. WHEN the daily billing job executes, THE Invoice_Generator SHALL process only customers whose billing cycle end date is on or before the current date and who do not already have a current invoice for that cycle
3. IF the billing job encounters an error for a specific customer, THEN THE Invoice_Generator SHALL log the error, skip that customer, and continue processing remaining customers
4. WHEN the billing job completes, THE Invoice_Generator SHALL record the total number of invoices created and any errors in the job execution log
5. IF the billing job is triggered manually with explicit cycle dates, THEN THE Invoice_Generator SHALL use the provided dates instead of calculating them from billing frequency

### Requirement 7: Data Migration for Existing Customers

**User Story:** As a system operator, I want existing customers to be assigned default values for pricing category and billing frequency, so that the platform continues to function correctly after the upgrade.

#### Acceptance Criteria

1. WHEN the database migration runs, THE Platform SHALL set the pricing category to "Cat 1" for all existing Customer records that have no pricing category
2. WHEN the database migration runs, THE Platform SHALL set the billing frequency to "monthly" for all existing Customer records that have no billing frequency
3. THE Platform SHALL complete the migration without altering any other existing Customer data
