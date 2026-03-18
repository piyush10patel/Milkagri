# Implementation Plan: Customer Pricing Tiers & Flexible Billing

## Overview

Incrementally add per-customer pricing categories and configurable billing frequency to the milk delivery platform. The plan starts with schema changes, then updates server-side logic (validation, price resolution, billing cycle calculation, invoice generation), replaces the monthly billing job with a daily one, and finishes with UI updates. Each step builds on the previous and wires into existing code.

## Tasks

- [x] 1. Database schema changes and migration
  - [x] 1.1 Add PricingCategory and BillingFrequency enums and update Customer and ProductPrice models in `prisma/schema.prisma`
    - Add `enum PricingCategory { cat_1 cat_2 cat_3 }`
    - Add `enum BillingFrequency { daily every_2_days weekly every_10_days monthly }`
    - Add `pricingCategory PricingCategory @default(cat_1)` to Customer model
    - Add `billingFrequency BillingFrequency @default(monthly)` to Customer model
    - Add `pricingCategory PricingCategory?` to ProductPrice model (nullable for fallback)
    - Update ProductPrice unique constraint to `[productVariantId, effectiveDate, branch, pricingCategory]`
    - Update ProductPrice lookup index to include `pricingCategory`
    - _Requirements: 1.1, 2.1, 2.2, 4.1, 7.1, 7.2, 7.3_

  - [x] 1.2 Run Prisma migration
    - Run `npx prisma migrate dev --name add_pricing_tiers_billing_frequency`
    - Existing customers get `cat_1` and `monthly` defaults via column defaults
    - Existing product prices get `null` pricingCategory (backward-compatible fallback)
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. Customer validation and service updates
  - [x] 2.1 Add pricingCategory and billingFrequency to customer Zod schemas in `src/server/modules/customers/customers.types.ts`
    - Add `pricingCategory: z.enum(['cat_1', 'cat_2', 'cat_3']).optional()` to createCustomerSchema
    - Add `billingFrequency: z.enum(['daily', 'every_2_days', 'weekly', 'every_10_days', 'monthly']).optional()` to createCustomerSchema
    - Add same fields to updateCustomerSchema
    - Update inferred types
    - _Requirements: 1.1, 1.5, 4.1, 4.5_

  - [x] 2.2 Update `createCustomer` and `updateCustomer` in `src/server/modules/customers/customers.service.ts` to pass new fields to Prisma
    - Include `pricingCategory` and `billingFrequency` in create/update data
    - _Requirements: 1.2, 1.3, 4.2, 4.3_

  - [ ]* 2.3 Write property tests for customer pricing category validation (Property 1)
    - **Property 1: Pricing category validation rejects invalid values**
    - Generate arbitrary strings not in allowed set and verify Zod rejects them
    - **Validates: Requirements 1.1, 1.5**

  - [ ]* 2.4 Write property tests for customer billing frequency validation (Property 2)
    - **Property 2: Billing frequency validation rejects invalid values**
    - Generate arbitrary strings not in allowed set and verify Zod rejects them
    - **Validates: Requirements 4.1, 4.5**

  - [ ]* 2.5 Write property test for customer field update round-trip (Property 3)
    - **Property 3: Customer field update round-trip**
    - For any valid pricingCategory and billingFrequency, set then read back and verify equality
    - **Validates: Requirements 1.3, 4.3**

- [x] 3. Product pricing validation and service updates
  - [x] 3.1 Add pricingCategory to `addPriceSchema` in `src/server/modules/products/products.types.ts`
    - Add `pricingCategory: z.enum(['cat_1', 'cat_2', 'cat_3']).nullable().optional()`
    - Update `AddPriceInput` type
    - _Requirements: 2.1, 2.5_

  - [x] 3.2 Update `addPrice` in `src/server/modules/products/products.service.ts` to include pricingCategory in Prisma create
    - Pass `input.pricingCategory ?? null` to `productPrice.create`
    - _Requirements: 2.1, 2.3_

  - [ ]* 3.3 Write property test for product price category uniqueness (Property 4)
    - **Property 4: Product price category uniqueness constraint**
    - Insert two prices with same (variantId, effectiveDate, branch, pricingCategory) and verify conflict error
    - **Validates: Requirements 2.2**

  - [ ]* 3.4 Write property test for price entry validation (Property 5)
    - **Property 5: Price entry validation rejects invalid pricing category**
    - Generate arbitrary strings not in allowed set and verify Zod rejects them
    - **Validates: Requirements 2.5**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Price resolution with category support
  - [x] 5.1 Update `getEffectivePrice` in `src/server/lib/pricing.ts` to accept and use pricingCategory parameter
    - Add `pricingCategory?: PricingCategory | null` parameter
    - Implement 4-step resolution: branch+category → branch+null → null branch+category → null branch+null category
    - Throw `NotFoundError` if no price found at all
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 5.2 Write property test for price resolution with fallback (Property 6)
    - **Property 6: Price resolution returns most recent category-specific price with fallback**
    - Generate price histories across dates and categories, verify correct lookup and fallback behavior
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 5.3 Write property test for price resolution round-trip (Property 7)
    - **Property 7: Price resolution round-trip consistency**
    - Resolve a price, then resolve again with same params, verify equivalent result
    - **Validates: Requirements 3.5**

- [-] 6. Billing cycle calculator
  - [x] 6.1 Create `src/server/lib/billingCycle.ts` with cycle calculation functions
    - Implement `getCycleForDate(frequency, referenceDate): BillingCycle`
    - Implement `getNextCycle(frequency, lastCycleEnd): BillingCycle`
    - Implement `isCycleComplete(cycle, today): boolean`
    - Handle all frequencies: daily (1 day), every_2_days (2 days), weekly (7 days), every_10_days (10 days), monthly (calendar month)
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 6.2 Write property test for billing cycle length (Property 9)
    - **Property 9: Billing cycle length matches frequency**
    - Generate random frequencies and dates, verify cycle duration matches expected length
    - **Validates: Requirements 5.1, 5.3, 5.4, 5.5, 5.6, 5.7**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Billing service updates for per-customer invoicing
  - [x] 8.1 Add `generateInvoiceForCustomer` function in `src/server/modules/billing/billing.service.ts`
    - Accept `customerId`, `cycleStart`, `cycleEnd` parameters
    - Query delivered orders for the customer within the cycle
    - Pass `customer.pricingCategory` to `getEffectivePrice` for each line item
    - Carry forward closing balance from most recent prior invoice as opening balance
    - Create invoice with line items in a transaction
    - _Requirements: 3.4, 5.1, 5.8_

  - [x] 8.2 Add `runDailyBillingJob` function in `src/server/modules/billing/billing.service.ts`
    - Query all active customers
    - For each customer, determine next billing cycle using `billingFrequency` and most recent invoice's `billingCycleEnd`
    - If cycle is complete (end ≤ today), call `generateInvoiceForCustomer`
    - Skip customers who already have an invoice for the current cycle
    - Wrap each customer in try/catch for error isolation
    - Return summary with counts and errors
    - _Requirements: 5.2, 6.2, 6.3, 6.4_

  - [ ]* 8.3 Write property test for invoice line items using customer pricing category (Property 8)
    - **Property 8: Invoice line items use customer's pricing category**
    - Create customer with non-default category and category-specific prices, verify line item unit prices match
    - **Validates: Requirements 3.4**

  - [ ]* 8.4 Write property test for invoice opening balance chain (Property 10)
    - **Property 10: Invoice opening balance equals previous closing balance**
    - Generate sequences of invoices and verify opening/closing balance linkage
    - **Validates: Requirements 5.8**

  - [ ]* 8.5 Write property test for billing job customer selection (Property 11)
    - **Property 11: Billing job skips customers not due and already invoiced**
    - Generate customer sets with various frequencies and invoice histories, verify correct filtering
    - **Validates: Requirements 5.2, 6.2**

  - [ ]* 8.6 Write property test for billing job error isolation (Property 12)
    - **Property 12: Billing job error isolation**
    - Inject failures for K of N customers, verify remaining N-K succeed and summary reports K errors
    - **Validates: Requirements 6.3**

- [x] 9. Daily invoice generation job
  - [x] 9.1 Create `src/server/jobs/dailyInvoiceGeneration.ts` replacing monthly job
    - Define `DailyInvoiceGenerationData` interface with `triggeredBy`, `userId`, optional explicit cycle dates
    - Implement BullMQ processor that calls `runDailyBillingJob` (or `generateInvoiceForCustomer` with explicit dates for manual triggers)
    - Implement concurrency lock via `job_executions` table
    - Record job execution with counts and errors
    - Notify super admins on failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 9.2 Update `src/server/jobs/index.ts` to register daily invoice job and remove monthly invoice job
    - Replace `monthlyInvoiceQueue` with `dailyInvoiceQueue`
    - Replace `startMonthlyInvoiceWorker` with `startDailyInvoiceWorker`
    - Update `registerSchedules` to use daily cron (e.g., `0 3 * * *`) instead of monthly
    - Update `triggerManualInvoiceGeneration` to use the new queue
    - Update `stopWorker` to close the new worker
    - _Requirements: 6.1, 6.5_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Customer form UI updates
  - [x] 11.1 Add pricing category and billing frequency selectors to `src/client/pages/customers/CustomerFormPage.tsx`
    - Add `<select>` for Pricing Category with options: Cat 1, Cat 2, Cat 3
    - Add `<select>` for Billing Frequency with options: Daily, Every 2 Days, Weekly, Every 10 Days, Monthly
    - Wire values to form state and submit payload
    - _Requirements: 1.4, 4.4_

  - [x] 11.2 Display pricing category and billing frequency on `src/client/pages/customers/CustomerDetailPage.tsx`
    - Show the customer's current pricing category and billing frequency in the detail view
    - _Requirements: 1.3, 4.3_

- [x] 12. Product form UI updates
  - [x] 12.1 Add pricing category selector to price entry form in `src/client/pages/products/ProductFormPage.tsx`
    - Add a pricing category dropdown to the price entry section within each variant
    - Show price inputs for all three categories when managing variant prices
    - Include null/default option for backward-compatible pricing
    - _Requirements: 2.3, 2.4_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The migration uses column defaults so existing data is automatically backfilled (Requirement 7)
- The monthly invoice job file (`monthlyInvoiceGeneration.ts`) can be deleted after task 9.2 is verified working
