# Implementation Plan: Milk Delivery Platform

## Overview

Phased implementation of a self-hosted milk delivery management platform. The plan follows MVP-first approach: project scaffolding → auth/RBAC → core data models → subscriptions → order generation → delivery ops → billing/payments → reports → deployment. Each phase builds incrementally on the previous, with property-based tests for critical business logic. Post-MVP modules (inventory, advanced features) are included as optional tasks.

## Tasks

- [x] 1. Project scaffolding and infrastructure setup
  - [x] 1.1 Initialize monorepo structure with Express backend and React frontend
    - Create directory structure per design: `src/server/`, `src/client/`, `prisma/`
    - Initialize `package.json` with dependencies: express, prisma, @prisma/client, bullmq, ioredis, passport, passport-local, express-session, connect-redis, csurf, helmet, cors, bcrypt, zod, pdfkit, nodemailer, uuid
    - Initialize Vite React app in `src/client/` with dependencies: react, react-dom, react-router-dom, @tanstack/react-query, tailwindcss, shadcn/ui
    - Configure TypeScript (`tsconfig.json`) for both server and client
    - Configure Vitest and fast-check for testing
    - _Requirements: 15.1, 15.6_

  - [x] 1.2 Create Prisma schema with all database models
    - Define all tables from the design document in `prisma/schema.prisma`: users, customers, customer_addresses, products, product_variants, product_prices, subscriptions, vacation_holds, quantity_changes, subscription_changes, delivery_orders, routes, route_customers, route_agents, invoices, invoice_line_items, invoice_adjustments, invoice_discounts, payments, ledger_entries, holidays, route_holidays, audit_logs, notifications, system_settings, job_executions
    - Add all indexes, unique constraints, and check constraints per design
    - Generate initial Prisma migration
    - _Requirements: 15.2_

  - [x] 1.3 Create Docker Compose and deployment configuration
    - Create `docker-compose.yml` with services: app, worker, postgres, redis, nginx
    - Create `Dockerfile` with multi-stage build (build client, run server)
    - Create `nginx.conf` for reverse proxy with HTTPS termination config
    - Create `.env.example` with all environment variables documented
    - _Requirements: 15.1, 15.4, 15.5, 15.6, 14.5_

  - [x] 1.4 Set up Express server entry point and middleware stack
    - Create `src/server/index.ts` with Express app initialization
    - Wire middleware in order: helmet, cors, express.json, session (Redis store), csrf, rateLimiter, errorHandler
    - Create `src/server/middleware/errorHandler.ts` for centralized error handling
    - Create `src/server/middleware/rateLimiter.ts` with IP-based and user-based limits (100/min auth, 1000/min API)
    - Create health check endpoint at `GET /api/health` returning app and DB status
    - _Requirements: 14.2, 14.3, 14.4, 15.8_

  - [x] 1.5 Create shared utility modules
    - Create `src/server/lib/pagination.ts` for paginated query helpers
    - Create `src/server/lib/validation.ts` for Zod schema validation middleware
    - Create `src/server/lib/errors.ts` for custom error classes (AppError, NotFoundError, ForbiddenError, ValidationError)
    - _Requirements: 14.1, 14.8_

- [x] 2. Checkpoint - Verify project builds and health check works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Authentication and user management
  - [x] 3.1 Implement authentication module
    - Create `src/server/modules/auth/auth.routes.ts` with POST /auth/login, POST /auth/logout, GET /auth/me
    - Create `src/server/modules/auth/auth.controller.ts` with login validation, session creation, logout handling
    - Create `src/server/modules/auth/auth.service.ts` with bcrypt password verification (cost factor 10+), account lockout logic (5 failures in 15 min → 30 min lock), session invalidation
    - Create `src/server/middleware/authenticate.ts` for session validation on protected routes
    - Create `src/server/middleware/csrf.ts` for CSRF token generation and validation on state-changing requests
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 14.2_

  - [x] 3.2 Implement RBAC middleware and user management
    - Create `src/server/middleware/authorize.ts` accepting allowed roles array, returning 403 for insufficient privileges
    - Create `src/server/modules/users/users.routes.ts` with GET/POST/PUT /users, PATCH /users/:id/deactivate (Super_Admin only)
    - Create `src/server/modules/users/users.service.ts` with CRUD operations, role assignment, session invalidation on deactivation
    - Create `src/server/modules/users/users.types.ts` with Zod schemas for user creation/update
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 3.3 Write unit tests for auth and RBAC
    - Test login success/failure flows, session creation, account lockout after 5 failures
    - Test RBAC middleware allows/denies correct roles for each endpoint
    - Test session invalidation on user deactivation
    - _Requirements: 1.1, 1.2, 1.5, 2.2, 2.8_

- [x] 4. Audit logging module
  - [x] 4.1 Implement audit log recording and query
    - Create `src/server/modules/audit/audit.service.ts` with append-only log creation (entity type, entity ID, action, old/new values, user context)
    - Create `src/server/middleware/auditLog.ts` as post-response middleware that records create/update/delete operations
    - Create `src/server/modules/audit/audit.routes.ts` with GET /audit-logs (Super_Admin, Admin) with search, filter by entity type, user, date range, pagination
    - Create `src/server/modules/audit/audit.types.ts` with Zod schemas for query params
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 5. Customer management
  - [x] 5.1 Implement customer CRUD and address management
    - Create `src/server/modules/customers/customers.routes.ts` with all customer endpoints per design
    - Create `src/server/modules/customers/customers.controller.ts` with request handling and validation
    - Create `src/server/modules/customers/customers.service.ts` with: create customer (unique phone), update, status changes (active/paused/stopped), multiple addresses with primary flag, search by name/phone/address/route/status, paginated list with sorting and filtering
    - Create `src/server/modules/customers/customers.types.ts` with Zod schemas
    - Integrate audit logging on all create/update/delete operations
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.9, 3.10_

  - [x] 5.2 Implement customer status change workflows
    - In customers.service.ts: when status → paused, suspend all active subscriptions (set status='paused')
    - When status → stopped, cancel all active subscriptions (set end_date, status='cancelled'), exclude from future order generation
    - When status → active (from paused), resume previously suspended subscriptions from next eligible delivery date
    - Record all status changes in audit log
    - _Requirements: 3.6, 3.7, 3.8_

  - [x] 5.3 Write unit tests for customer management
    - Test unique phone constraint enforcement
    - Test status change cascading to subscriptions (pause → suspend, stop → cancel, reactivate → resume)
    - Test address primary flag management
    - _Requirements: 3.2, 3.6, 3.7, 3.8_

- [x] 6. Product management and pricing
  - [x] 6.1 Implement product and variant CRUD
    - Create `src/server/modules/products/products.routes.ts` with all product endpoints per design
    - Create `src/server/modules/products/products.controller.ts` with request handling
    - Create `src/server/modules/products/products.service.ts` with: create product, create variants (unit type, quantity per unit, SKU), deactivate variant (preserve history), list with filtering
    - Create `src/server/modules/products/products.types.ts` with Zod schemas
    - Integrate audit logging
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 6.2 Implement pricing with effective dates and branch overrides
    - In products.service.ts: add price entry with effective_date, query effective price for a given date (most recent price where effective_date <= target date), support branch-wise pricing overrides (NULL branch = default), price history query
    - Create `src/server/lib/pricing.ts` with `getEffectivePrice(variantId, date, branch?)` utility
    - _Requirements: 4.3, 4.4, 4.5, 4.7, 4.8_

  - [x] 6.3 Write property tests for price lookup logic
    - **Property 1: Effective price lookup always returns the most recent price on or before the target date**
    - **Validates: Requirements 4.4, 4.5**
    - Use fast-check to generate random price histories (multiple effective dates) and target dates, verify the correct price is selected
    - **Property 2: Future-dated prices are never applied before their effective date**
    - **Validates: Requirements 4.5**
    - Generate price entries with future dates, verify current price is used for today's lookups
    - **Property 3: Branch override takes precedence over default price when branch matches**
    - **Validates: Requirements 4.7**

- [x] 7. Checkpoint - Verify core data models work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Subscription management
  - [x] 8.1 Implement subscription CRUD and frequency logic
    - Create `src/server/modules/subscriptions/subscriptions.routes.ts` with all subscription endpoints per design
    - Create `src/server/modules/subscriptions/subscriptions.controller.ts`
    - Create `src/server/modules/subscriptions/subscriptions.service.ts` with: create subscription (customer, variant, quantity, frequency, start date), support daily/alternate_day/custom_weekday frequencies, cancel subscription (set end_date), multiple subscriptions per customer
    - Create `src/server/modules/subscriptions/subscriptions.types.ts` with Zod schemas
    - Create `src/server/lib/frequency.ts` with `shouldDeliverOnDate(subscription, targetDate)` — core frequency matching logic for daily, alternate-day (every other day from start), custom weekday
    - Integrate audit logging and subscription_changes tracking
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 5.10, 5.11_

  - [x] 8.2 Write property tests for subscription frequency matching
    - **Property 4: Daily subscriptions generate an order for every date within their active range**
    - **Validates: Requirements 5.2, 6.2**
    - **Property 5: Alternate-day subscriptions generate orders on exactly every other day from start date**
    - **Validates: Requirements 5.3**
    - Use fast-check to generate random start dates and target dates, verify alternate-day pattern holds (difference in days from start is even)
    - **Property 6: Custom weekday subscriptions only generate orders on selected weekdays**
    - **Validates: Requirements 5.4**
    - Generate random weekday selections and target dates, verify orders only on selected days

  - [x] 8.3 Implement vacation holds and quantity changes
    - In subscriptions.service.ts: create vacation hold (start_date, end_date), resume from hold early (set resumed_at), schedule quantity change with future effective_date, apply pending quantity changes when effective_date arrives
    - Implement cutoff time logic: changes after cutoff apply to day after next delivery
    - _Requirements: 5.5, 5.6, 5.8, 5.9_

  - [x] 8.4 Write property tests for vacation hold exclusions
    - **Property 7: Subscriptions with active vacation holds never generate orders within the hold date range**
    - **Validates: Requirements 5.5, 6.3**
    - Generate random hold ranges and target dates, verify exclusion logic
    - **Property 8: Resumed vacation holds stop excluding orders from the resume date onward**
    - **Validates: Requirements 5.6**

- [-] 9. Holiday and exception management
  - [x] 9.1 Implement holiday calendar and route exceptions
    - Create `src/server/modules/holidays/holidays.routes.ts` with GET/POST/DELETE /holidays
    - Create `src/server/modules/holidays/holidays.service.ts` with: add system-wide holiday, add route-specific holiday (route_holidays table), delete future holiday, query holidays for date range
    - Create `src/server/modules/holidays/holidays.types.ts` with Zod schemas
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

- [x] 10. Daily order generation
  - [x] 10.1 Implement order generation engine
    - Create `src/server/modules/orders/orders.service.ts` with `generateOrdersForDate(targetDate)`:
      - Get all active subscriptions
      - For each: check customer status (skip paused/stopped), check frequency match via `shouldDeliverOnDate()`, check vacation holds, check system-wide holidays, check route-specific holidays
      - Apply pending quantity changes if effective_date <= targetDate
      - Create delivery_order records with auto_generated=true
      - Prevent duplicates via unique constraint (subscription_id, delivery_date)
      - Return summary: total orders created, grouped by route and product variant
    - Create `src/server/modules/orders/orders.routes.ts` with GET /orders, POST /orders (one-time), PUT/DELETE /orders/:id, POST /orders/generate (manual trigger), GET /orders/summary
    - Create `src/server/modules/orders/orders.controller.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [x] 10.2 Write property tests for order generation exclusions
    - **Property 9: Orders are never generated for customers with paused or stopped status**
    - **Validates: Requirements 6.4**
    - **Property 10: Orders are never generated on system-wide holidays**
    - **Validates: Requirements 6.6**
    - **Property 11: Orders are never generated for subscriptions with active vacation holds on the target date**
    - **Validates: Requirements 6.3**
    - **Property 12: Orders are never generated on route-specific holidays for subscriptions on that route**
    - **Validates: Requirements 6.5**
    - Use fast-check to generate combinations of subscriptions, holidays, holds, and customer statuses, verify all exclusion rules

  - [x] 10.3 Implement BullMQ job for daily order generation
    - Create `src/server/jobs/dailyOrderGeneration.ts` as BullMQ processor
    - Implement concurrency lock to prevent duplicate runs
    - Log job execution to job_executions table (start, end, status, records processed)
    - On failure: log error, create notification for Super_Admin users
    - Create `src/server/jobs/index.ts` to register cron schedule and manual trigger queue
    - _Requirements: 6.1, 6.10, 17.1, 17.2, 17.5, 17.6, 17.7_

- [x] 11. Route management
  - [x] 11.1 Implement route CRUD and customer assignment
    - Create `src/server/modules/routes/routes.routes.ts` with all route endpoints per design
    - Create `src/server/modules/routes/routes.service.ts` with: create route, assign customers with sequence order, assign agents, reorder customers (drag-and-drop sequence), deactivate route (require customer reassignment first), route summary stats
    - Create `src/server/modules/routes/routes.controller.ts`
    - Create `src/server/modules/routes/routes.types.ts` with Zod schemas
    - When customer reassigned to different route, update future delivery_orders
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8_

  - [x] 11.2 Implement route manifest generation
    - In routes.service.ts: generate route manifest for a date — list delivery orders in sequence order with customer name, address, delivery notes, products, quantities
    - Create printable manifest endpoint (GET /routes/:id/manifest/print) returning simplified HTML for printing
    - _Requirements: 8.6_

- [x] 12. Delivery operations
  - [x] 12.1 Implement delivery status marking and reconciliation
    - Create `src/server/modules/delivery/delivery.routes.ts` with all delivery endpoints per design
    - Create `src/server/modules/delivery/delivery.service.ts` with: get agent's manifest for date (ordered by route sequence), mark delivery status (delivered/skipped/failed/returned) with required reasons for skip/fail, record returned quantity, add delivery notes, end-of-day reconciliation summary (totals by product variant and status)
    - Create `src/server/modules/delivery/delivery.controller.ts`
    - Admin overview endpoint showing all routes/agents status for any date
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.9, 7.10_

- [x] 13. Checkpoint - Verify order generation and delivery flow works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Billing and invoicing
  - [x] 14.1 Implement invoice generation engine
    - Create `src/server/modules/billing/billing.service.ts` with `generateInvoicesForCycle(cycleStart, cycleEnd)`:
      - For each customer with delivered orders in the cycle: get all delivered delivery_orders, for each order look up effective price on delivery date via `getEffectivePrice()`, calculate line items (quantity × unit_price), get previous invoice closing balance as opening balance, calculate totals: opening_balance + charges - discounts + adjustments - payments = closing_balance
      - Create invoice record with line items, set payment_status
      - Support invoice regeneration (increment version, mark old as is_current=false)
    - Create `src/server/modules/billing/billing.routes.ts` with all billing endpoints per design
    - Create `src/server/modules/billing/billing.controller.ts`
    - Create `src/server/modules/billing/billing.types.ts` with Zod schemas
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.7, 9.8, 9.10, 9.12_

  - [x] 14.2 Write property tests for billing calculations
    - **Property 13: Invoice total charges equal the sum of all line item totals**
    - **Validates: Requirements 9.3**
    - Generate random sets of delivery orders with quantities and prices, verify sum consistency
    - **Property 14: Mid-month price changes apply old price before effective date and new price on/after**
    - **Validates: Requirements 9.4**
    - Generate price change scenarios with deliveries spanning the change date, verify correct price applied to each delivery
    - **Property 15: Invoice closing balance equals opening_balance + charges - discounts + adjustments - payments**
    - **Validates: Requirements 9.8**
    - Generate random invoice components, verify the balance formula holds

  - [x] 14.3 Implement invoice adjustments and discounts
    - In billing.service.ts: add manual adjustment (credit/debit with reason), add discount (percentage or fixed amount), recalculate invoice totals after adjustment/discount
    - _Requirements: 9.5, 9.6_

  - [x] 14.4 Implement invoice PDF generation
    - Create `src/server/lib/pdf.ts` with PDFKit-based invoice PDF generator
    - Include: customer details, billing period, itemized deliveries with dates and prices, adjustments, payments, balance
    - Wire to GET /billing/invoices/:id/pdf endpoint
    - _Requirements: 9.9, 19.3, 19.4_

  - [x] 14.5 Implement BullMQ job for monthly invoice generation
    - Create `src/server/jobs/monthlyInvoiceGeneration.ts` as BullMQ processor
    - Implement concurrency lock, job execution logging, failure notification
    - Register cron schedule (first day after billing cycle ends) and manual trigger
    - _Requirements: 17.3, 17.4, 17.5, 17.6, 17.7_

- [x] 15. Payments and collections
  - [x] 15.1 Implement payment recording and collection
    - Create `src/server/modules/payments/payments.routes.ts` with all payment endpoints per design
    - Create `src/server/modules/payments/payments.service.ts` with: record payment (customer, amount, method, date), support partial payments (update invoice balance and status), support advance payments (credit balance on ledger), field collection recording by delivery agents, collection reconciliation (total by agent, handed over, discrepancies), customer outstanding summary
    - Create `src/server/modules/payments/payments.controller.ts`
    - Create `src/server/modules/payments/payments.types.ts` with Zod schemas
    - Auto-update invoice status: paid when payments >= total, partial otherwise
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [x] 15.2 Write unit tests for payment logic
    - Test partial payment updates invoice status to 'partial'
    - Test full payment updates invoice status to 'paid'
    - Test advance payment creates credit balance
    - Test credit balance auto-applied to new invoice
    - _Requirements: 10.3, 10.4, 10.5_

- [x] 16. Customer ledger and financial history
  - [x] 16.1 Implement customer ledger
    - Create `src/server/modules/ledger/ledger.service.ts` with: create ledger entry on invoice charge, payment, adjustment, credit application; calculate running balance; query ledger entries for customer in chronological order
    - Create `src/server/modules/ledger/ledger.routes.ts` — wire to GET /customers/:id/ledger
    - Create ledger PDF export endpoint (GET /customers/:id/ledger/pdf) for date range
    - Integrate ledger entry creation into billing.service.ts (on invoice generation) and payments.service.ts (on payment recording)
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

  - [x] 16.2 Write property tests for ledger balance calculations
    - **Property 16: Running balance after any entry equals previous balance + debits - credits**
    - **Validates: Requirements 21.2**
    - Generate random sequences of ledger entries (charges, payments, adjustments), verify running balance consistency at each step
    - **Property 17: The final ledger balance equals total debits minus total credits across all entries**
    - **Validates: Requirements 21.1, 21.2**

- [x] 17. Checkpoint - Verify billing, payments, and ledger flow works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Reports and data export
  - [x] 18.1 Implement report queries and endpoints
    - Create `src/server/modules/reports/reports.routes.ts` with all 7 report endpoints per design
    - Create `src/server/modules/reports/reports.service.ts` with: daily delivery quantity report (grouped by product variant), route-wise delivery report (counts by status per route), customer outstanding report (unpaid balances with aging), revenue report (by day/week/month), product sales report (quantities by variant), missed deliveries report (skipped/failed with reasons), subscription change audit report
    - All reports support date range filtering, sorting, and pagination
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.9, 11.10_

  - [x] 18.2 Implement CSV export for all reports
    - Create `src/server/lib/csvExport.ts` with generic CSV generation (UTF-8 encoding, proper headers)
    - Wire GET /reports/:type/csv endpoints to generate downloadable CSV files
    - _Requirements: 11.8, 19.1_

- [x] 19. Notification system
  - [x] 19.1 Implement notification dashboard and email dispatch
    - Create `src/server/modules/notifications/notifications.routes.ts` with GET /notifications, PATCH /notifications/:id/read
    - Create `src/server/modules/notifications/notifications.service.ts` with: create dashboard notification, mark as read, query notifications (reverse chronological, read/unread status)
    - Create `src/server/lib/notificationProvider.ts` with pluggable provider interface: DashboardNotificationProvider (writes to notifications table), EmailNotificationProvider (Nodemailer SMTP configured via env vars)
    - Create `src/server/modules/notifications/notifications.types.ts`
    - Integrate notification creation into: daily order generation failure, billing errors, account lockout events
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.7, 12.8_

  - [x] 19.2 Implement notification configuration
    - In settings module: allow Admin users to configure which event types trigger notifications and through which channels (dashboard, email)
    - Store notification preferences in system_settings table
    - _Requirements: 12.6_

- [x] 20. System settings
  - [x] 20.1 Implement settings module
    - Create `src/server/modules/settings/settings.routes.ts` with GET/PUT /settings (Super_Admin only)
    - Create `src/server/modules/settings/settings.service.ts` with: get/update system settings (billing_cycle_start_day, cutoff_time, notification preferences)
    - Create `src/server/modules/settings/settings.types.ts` with Zod schemas
    - _Requirements: 9.1, 5.9, 16.8_

- [x] 21. Seed data and database setup
  - [x] 21.1 Create seed data script
    - Create `prisma/seed.ts` with sample data: Super_Admin account, Admin account, Delivery_Agent accounts, sample customers with addresses, sample products with variants and prices, sample subscriptions, sample routes with customer assignments, sample holidays
    - Implement auto-migration on app startup (run pending migrations before accepting requests)
    - _Requirements: 15.3, 15.7_

- [x] 22. Checkpoint - Verify all backend modules work together
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Frontend - Layout and authentication UI
  - [x] 23.1 Set up React app shell with routing and auth
    - Configure React Router with protected routes and role-based route guards
    - Create `src/client/components/Layout.tsx` with sidebar navigation, top bar with user info/logout
    - Create `src/client/pages/LoginPage.tsx` with credentials form, error display, CSRF token handling
    - Create `src/client/hooks/useAuth.ts` for session management (GET /auth/me on load, login/logout)
    - Create `src/client/lib/api.ts` with fetch wrapper (base URL, CSRF header, error handling)
    - Responsive layout: sidebar collapses to hamburger menu on mobile (320px–768px)
    - _Requirements: 16.1, 1.1, 1.7_

  - [x] 23.2 Create admin dashboard page
    - Create `src/client/pages/DashboardPage.tsx` with summary cards: today's total deliveries, pending deliveries, total revenue this month, outstanding payments, active customer count
    - Fetch data from relevant API endpoints
    - _Requirements: 16.2_

- [x] 24. Frontend - Core CRUD screens
  - [x] 24.1 Implement customer management screens
    - Create `src/client/pages/customers/CustomerListPage.tsx` with paginated table, search by name/phone/status, filters, sorting
    - Create `src/client/pages/customers/CustomerFormPage.tsx` for create/edit with inline validation errors
    - Create `src/client/pages/customers/CustomerDetailPage.tsx` showing profile, addresses, subscriptions, ledger summary
    - Status change actions (pause/stop/reactivate) with confirmation dialogs
    - _Requirements: 16.3, 16.9, 3.9, 3.10, 3.11_

  - [x] 24.2 Implement product management screens
    - Create `src/client/pages/products/ProductListPage.tsx` with product and variant listing
    - Create `src/client/pages/products/ProductFormPage.tsx` for create/edit product and variants
    - Create pricing management UI: add price with effective date, view price history, branch overrides
    - _Requirements: 16.3, 4.8_

  - [x] 24.3 Implement subscription management screens
    - Create `src/client/pages/subscriptions/SubscriptionListPage.tsx` with filtering by customer, product, status (active/paused/cancelled)
    - Create `src/client/pages/subscriptions/SubscriptionFormPage.tsx` for create/edit with frequency selection (daily/alternate-day/custom weekday picker)
    - Vacation hold management: create hold, resume early
    - Quantity change scheduling with effective date
    - Subscription change history view
    - _Requirements: 16.3, 16.5_

  - [x] 24.4 Implement route management screens
    - Create `src/client/pages/routes/RouteListPage.tsx` with route listing and summary stats
    - Create `src/client/pages/routes/RouteFormPage.tsx` for create/edit
    - Customer assignment UI with drag-and-drop sequence ordering
    - Agent assignment UI
    - _Requirements: 16.3, 8.4_

  - [x] 24.5 Implement staff user management screens
    - Create `src/client/pages/users/UserListPage.tsx` (Super_Admin only)
    - Create `src/client/pages/users/UserFormPage.tsx` for create/edit with role assignment
    - Deactivation action with confirmation
    - _Requirements: 16.3, 2.3_

- [x]  /
  - [x] 25.1 Implement daily operations and delivery sheet screen
    - Create `src/client/pages/orders/DailyOperationsPage.tsx` showing delivery sheet for selected date
    - Filter by route and delivery agent
    - Display holiday indicators on the date
    - Manual order add/edit/remove actions
    - Manual trigger for daily order generation (Super_Admin)
    - _Requirements: 16.4, 20.4_

  - [x] 25.2 Implement delivery agent mobile-friendly screen
    - Create `src/client/pages/delivery/DeliveryManifestPage.tsx` optimized for mobile (touch-friendly, large tap targets)
    - Show route manifest in sequence order with customer info, products, quantities
    - Status marking buttons: delivered, skipped (with reason picker), failed (with reason), returned (with quantity)
    - Delivery notes input
    - End-of-day reconciliation summary view
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 16.1_

  - [x] 25.3 Implement billing and payment screens
    - Create `src/client/pages/billing/InvoiceListPage.tsx` with filtering by customer, status, billing cycle
    - Create `src/client/pages/billing/InvoiceDetailPage.tsx` showing line items, adjustments, discounts, payments, PDF download
    - Create `src/client/pages/payments/PaymentFormPage.tsx` for recording payments
    - Create `src/client/pages/payments/OutstandingPage.tsx` showing customer outstanding summary
    - Collection reconciliation screen for Admin
    - _Requirements: 16.6, 10.8, 10.9_

  - [x] 25.4 Implement customer ledger screen
    - Create `src/client/pages/ledger/CustomerLedgerPage.tsx` showing chronological ledger entries with running balance
    - Date range filter, PDF export button
    - _Requirements: 3.11, 21.3, 21.5_

- [x] 26. Frontend - Reports and settings
  - [x] 26.1 Implement reports dashboard and report pages
    - Create `src/client/pages/reports/ReportsDashboardPage.tsx` with navigation to all 7 report types
    - Create individual report pages with date range filtering, tabular display with sorting/pagination, CSV export button
    - _Requirements: 16.7, 11.1–11.10_

  - [x] 26.2 Implement settings page
    - Create `src/client/pages/settings/SettingsPage.tsx` (Super_Admin only)
    - Configure: billing cycle start day, cutoff time, holiday calendar management, notification preferences
    - _Requirements: 16.8_

  - [x] 26.3 Implement notification UI
    - Create notification bell icon in top bar with unread count badge
    - Create `src/client/pages/notifications/NotificationsPage.tsx` with reverse chronological list, read/unread status, click to mark as read
    - _Requirements: 12.1, 12.7, 12.8_

  - [x] 26.4 Implement audit log viewer
    - Create `src/client/pages/audit/AuditLogPage.tsx` (Super_Admin, Admin) with search, filter by entity type/user/date range, pagination
    - _Requirements: 13.3_

- [x] 27. Frontend - Print layouts and accessibility
  - [x] 27.1 Implement print-friendly layouts
    - Create print CSS styles for invoices, route manifests, and delivery sheets
    - Ensure clean print output without navigation/sidebar elements
    - _Requirements: 19.2_

  - [x] 27.2 Add keyboard navigation and ARIA labels
    - Ensure all interactive elements have appropriate ARIA labels
    - Implement keyboard navigation for forms, tables, and modals
    - Add focus management for modal dialogs and page transitions
    - _Requirements: 16.10_

- [x] 28. Checkpoint - Verify full frontend works with backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 29. Security hardening and input validation
  - [x] 29.1 Implement comprehensive input validation and security measures
    - Add Zod validation schemas to all API endpoints (request body, query params, URL params)
    - Ensure all Prisma queries use parameterized inputs (ORM default)
    - Verify CSRF protection on all state-changing endpoints
    - Verify rate limiting is active on auth endpoints (100/min per IP) and API endpoints (1000/min per user)
    - Add input sanitization for text fields to prevent XSS
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.8_

  - [x] 29.2 Create backup strategy documentation and scripts
    - Create `scripts/backup.sh` for automated daily PostgreSQL dumps using pg_dump
    - Create `scripts/restore.sh` for database restore procedure
    - Add backup configuration to docker-compose (volume mounts, retention)
    - _Requirements: 14.7_

- [x] 30. README and deployment documentation
  - [x] 30.1 Create comprehensive README
    - Write `README.md` with: project overview, prerequisites, local development setup instructions, production deployment steps, running migrations, seeding data, creating first Super_Admin account, environment variable reference, backup/restore procedures
    - _Requirements: 15.5_

- [x] 31. Final checkpoint - Full MVP verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 32. Post-MVP: Inventory lite module
  - [x] 32.1 Implement inventory tracking
    - Create `src/server/modules/inventory/inventory.routes.ts` with endpoints for recording inward stock, wastage, and querying stock levels
    - Create `src/server/modules/inventory/inventory.service.ts` with: record daily inward stock (variant, quantity, date, supplier), record wastage/spoilage (variant, quantity, date, reason), calculate closing stock (opening + inward - delivered - wastage), carry forward closing stock as next day's opening, daily stock reconciliation report, negative stock warning alerts
    - Create inventory UI screens for stock entry and reconciliation report
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [x] 32.2 Write property tests for inventory calculations
    - **Property 18: Closing stock equals opening stock + inward - delivered - wastage**
    - **Validates: Requirements 18.2**
    - **Property 19: Closing stock of day N equals opening stock of day N+1**
    - **Validates: Requirements 18.4**

- [x] 33. Post-MVP: Advanced notification channels
  - [x] 33.1 Implement additional notification providers
    - Add SMS provider stub implementing NotificationProvider interface
    - Add webhook provider for external integrations
    - Wire provider selection to notification configuration settings
    - _Requirements: 12.5_

- [x] 34. Final checkpoint - Post-MVP verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirement numbers for traceability
- Property-based tests use fast-check to validate critical business logic invariants
- Checkpoints are placed at natural phase boundaries for incremental validation
- The implementation order ensures each phase builds on completed dependencies
- Post-MVP tasks (32–34) are entirely optional and can be deferred
