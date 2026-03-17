# Requirements Document

## Introduction

A self-hosted, open-source milk delivery and management platform for internal business use. The system manages the full lifecycle of a milk delivery business: customer onboarding, product catalog, recurring subscriptions, daily delivery operations, route management, billing, payment collection, reporting, and administration. Designed for deployment on a single Linux server using Docker, with zero dependency on paid SaaS providers. The platform serves internal staff (admins, delivery agents, billing staff) through a responsive web UI.

## Glossary

- **Platform**: The milk delivery and management web application as a whole
- **Super_Admin**: A user role with unrestricted access to all platform features, settings, and user management
- **Admin**: A user role (branch manager level) with access to manage customers, products, subscriptions, deliveries, billing, and reports within their scope
- **Delivery_Agent**: A user role assigned to delivery routes who marks deliveries and handles field operations
- **Billing_Staff**: A user role responsible for invoice generation, payment recording, and financial reconciliation
- **Read_Only_User**: A user role with view-only access to dashboards and reports
- **Customer**: A person or household that receives milk/dairy product deliveries
- **Product**: A dairy item available for subscription or one-time order (e.g., cow milk, buffalo milk, curd, paneer, ghee)
- **Product_Variant**: A specific SKU of a Product defined by unit and quantity (e.g., cow milk 500ml packet, buffalo milk 1 liter)
- **Subscription**: A recurring delivery agreement for a Customer specifying Product_Variant, quantity, frequency, and date range
- **Delivery_Order**: A single delivery line item generated for a specific Customer, Product_Variant, quantity, and date
- **Delivery_Sheet**: The aggregated list of all Delivery_Orders for a given date, optionally filtered by route or agent
- **Route**: A named delivery path grouping a set of Customers in a defined sequence
- **Route_Manifest**: The daily printable/viewable list of stops and deliveries for a Route
- **Invoice**: A billing document summarizing delivered quantities and charges for a Customer over a billing period
- **Billing_Cycle**: The monthly period (configurable start date) over which deliveries are aggregated for invoicing
- **Payment**: A recorded monetary transaction from a Customer against outstanding invoices
- **Ledger**: The running financial record for a Customer showing charges, payments, adjustments, and balances
- **Audit_Log**: A chronological record of significant actions performed by users in the Platform
- **Notification**: An internal alert or external message sent to staff about system events
- **SMTP_Provider**: A self-hosted or open-source email relay used for sending email notifications
- **Cutoff_Time**: A configurable time after which subscription changes apply to the next eligible delivery date rather than the current day
- **Vacation_Hold**: A date range during which a Customer's Subscription deliveries are paused
- **Adjustment**: A manual credit or debit applied to a Customer's Ledger to correct billing discrepancies
- **Reconciliation**: The process of verifying delivered quantities, collected payments, and returned stock at end of day
- **Seed_Data**: Pre-populated sample data for development and demonstration purposes

## Requirements

### Requirement 1: User Authentication

**User Story:** As a staff member, I want to log in with my credentials, so that I can access the Platform securely based on my assigned role.

#### Acceptance Criteria

1. WHEN a staff member submits valid credentials, THE Platform SHALL authenticate the user and create a session
2. WHEN a staff member submits invalid credentials, THE Platform SHALL reject the login attempt and display an error message without revealing which field is incorrect
3. IF a user session exceeds the configured inactivity timeout, THEN THE Platform SHALL invalidate the session and redirect the user to the login page
4. THE Platform SHALL store passwords using bcrypt or argon2 hashing with a minimum cost factor of 10
5. WHEN a user attempts login and fails 5 consecutive times within 15 minutes, THE Platform SHALL lock the account for 30 minutes
6. THE Platform SHALL protect all authenticated endpoints with CSRF tokens
7. WHEN an authenticated user requests logout, THE Platform SHALL invalidate the session and clear session data

### Requirement 2: Role-Based Access Control

**User Story:** As a Super_Admin, I want to assign roles to staff accounts, so that each user can access only the features appropriate to their responsibilities.

#### Acceptance Criteria

1. THE Platform SHALL enforce five user roles: Super_Admin, Admin, Delivery_Agent, Billing_Staff, and Read_Only_User
2. WHEN a user with insufficient role privileges attempts to access a restricted resource, THE Platform SHALL deny access and return a 403 Forbidden response
3. THE Platform SHALL allow Super_Admin users to create, edit, deactivate, and assign roles to staff accounts
4. THE Platform SHALL allow Admin users to manage customers, products, subscriptions, deliveries, billing, and view reports
5. THE Platform SHALL restrict Delivery_Agent users to viewing their assigned Route_Manifest and marking delivery statuses
6. THE Platform SHALL restrict Billing_Staff users to invoice generation, payment recording, and financial reports
7. THE Platform SHALL restrict Read_Only_User users to viewing dashboards and reports without modification capabilities
8. WHEN a staff account is deactivated, THE Platform SHALL immediately invalidate all active sessions for that account

### Requirement 3: Customer Management

**User Story:** As an Admin, I want to manage customer profiles, so that I can maintain accurate delivery and contact information.

#### Acceptance Criteria

1. WHEN an Admin submits a new customer form with valid data, THE Platform SHALL create a Customer record with name, phone number, primary address, and status set to active
2. THE Platform SHALL require a unique phone number for each Customer record
3. THE Platform SHALL support multiple delivery addresses per Customer, with one address marked as the primary address
4. WHEN an Admin edits a Customer profile, THE Platform SHALL save the changes and record the modification in the Audit_Log
5. THE Platform SHALL store optional fields for each Customer: geo-location coordinates, delivery notes, and preferred delivery time window
6. WHEN an Admin changes a Customer status to paused, THE Platform SHALL suspend all active Subscriptions for that Customer without deleting them
7. WHEN an Admin changes a Customer status to stopped, THE Platform SHALL cancel all active Subscriptions and exclude the Customer from future Delivery_Sheet generation
8. WHEN an Admin reactivates a paused Customer, THE Platform SHALL resume previously suspended Subscriptions from the next eligible delivery date
9. THE Platform SHALL provide search functionality for Customers by name, phone number, address, Route, and status
10. THE Platform SHALL provide a filterable, sortable, paginated list of all Customers
11. THE Platform SHALL display a Customer Ledger showing all charges, payments, adjustments, and running balance for a selected Customer

### Requirement 4: Product Management

**User Story:** As an Admin, I want to manage the product catalog, so that I can define available dairy products with their variants and pricing.

#### Acceptance Criteria

1. WHEN an Admin creates a new Product, THE Platform SHALL store the product name, category, description, and active status
2. THE Platform SHALL support Product_Variants defined by unit type (liters, milliliters, packets, kilograms, pieces) and quantity per unit
3. WHEN an Admin sets a price for a Product_Variant, THE Platform SHALL require an effective start date and store the price with that date
4. THE Platform SHALL apply the most recent effective price (by start date) that is on or before the delivery date when calculating charges
5. WHEN a price change is recorded with a future effective date, THE Platform SHALL continue using the current price until that date arrives
6. THE Platform SHALL allow Admin users to deactivate a Product_Variant, preventing new Subscriptions while preserving historical delivery and billing records
7. THE Platform SHALL support optional branch-wise pricing overrides for each Product_Variant
8. THE Platform SHALL display a price history for each Product_Variant showing all effective dates and prices

### Requirement 5: Subscription Management

**User Story:** As an Admin, I want to create and manage delivery subscriptions for customers, so that recurring orders are generated automatically.

#### Acceptance Criteria

1. WHEN an Admin creates a Subscription, THE Platform SHALL require: Customer, Product_Variant, quantity, frequency, and start date
2. THE Platform SHALL support the following frequency types: daily, alternate-day, and custom weekday selection
3. WHEN a Subscription has an alternate-day frequency, THE Platform SHALL generate Delivery_Orders on every other day starting from the Subscription start date
4. WHEN a Subscription has a custom weekday frequency, THE Platform SHALL generate Delivery_Orders only on the selected days of the week
5. WHEN an Admin sets a Vacation_Hold on a Subscription with a start date and end date, THE Platform SHALL exclude that Subscription from Delivery_Order generation for all dates within the hold range (inclusive)
6. WHEN an Admin resumes a Subscription from a Vacation_Hold before the hold end date, THE Platform SHALL include the Subscription in Delivery_Order generation from the next eligible delivery date
7. WHEN an Admin cancels a Subscription, THE Platform SHALL set an end date and exclude the Subscription from all future Delivery_Order generation
8. WHEN an Admin schedules a quantity change with a future effective date, THE Platform SHALL use the current quantity until that date and the new quantity from that date onward
9. IF a Subscription change is submitted after the configured Cutoff_Time, THEN THE Platform SHALL apply the change starting from the day after the next delivery date
10. THE Platform SHALL allow multiple active Subscriptions per Customer for different Product_Variants
11. THE Platform SHALL maintain a complete change history for each Subscription including quantity changes, pauses, resumes, and cancellations with timestamps and the user who made the change

### Requirement 6: Daily Order Generation

**User Story:** As an Admin, I want the system to automatically generate daily delivery orders from active subscriptions, so that delivery agents have an accurate delivery sheet each day.

#### Acceptance Criteria

1. THE Platform SHALL run a scheduled job at a configurable time each day to generate Delivery_Orders for the next delivery date
2. WHEN the daily generation job runs, THE Platform SHALL create a Delivery_Order for each active Subscription whose frequency matches the target date
3. WHEN generating Delivery_Orders, THE Platform SHALL exclude Subscriptions that have an active Vacation_Hold covering the target date
4. WHEN generating Delivery_Orders, THE Platform SHALL exclude Subscriptions for Customers with status paused or stopped
5. WHEN a Route-specific holiday is configured for a date, THE Platform SHALL exclude all Subscriptions assigned to that Route from Delivery_Order generation for that date
6. WHEN a system-wide holiday is configured for a date, THE Platform SHALL skip Delivery_Order generation for all Subscriptions on that date
7. THE Platform SHALL allow Admin users to manually add one-time Delivery_Orders for any Customer and Product_Variant for a specific date
8. THE Platform SHALL allow Admin users to manually remove or modify auto-generated Delivery_Orders before the delivery date
9. THE Platform SHALL generate a Delivery_Sheet summary showing total quantities by Product_Variant, grouped by Route and Delivery_Agent
10. IF the daily generation job fails, THEN THE Platform SHALL log the error, send a Notification to Super_Admin users, and allow manual re-triggering of the job

### Requirement 7: Delivery Operations

**User Story:** As a Delivery_Agent, I want to view my daily delivery list and mark delivery statuses, so that I can complete my route efficiently and record outcomes.

#### Acceptance Criteria

1. WHEN a Delivery_Agent logs in, THE Platform SHALL display the agent's assigned Route_Manifest for the current date
2. THE Route_Manifest SHALL list Customers in the configured route sequence order, showing Customer name, address, delivery notes, and ordered Product_Variants with quantities
3. WHEN a Delivery_Agent marks a Delivery_Order as delivered, THE Platform SHALL record the delivery timestamp and the delivering agent
4. WHEN a Delivery_Agent marks a Delivery_Order as skipped, THE Platform SHALL require a reason selection (customer absent, customer refused, access issue, other) and record it
5. WHEN a Delivery_Agent marks a Delivery_Order as failed, THE Platform SHALL require a reason and record the failure for reconciliation
6. WHEN a Delivery_Agent marks a Delivery_Order as returned, THE Platform SHALL record the returned quantity for stock reconciliation
7. THE Platform SHALL allow Delivery_Agents to add free-text delivery notes to any Delivery_Order
8. THE Platform SHALL provide a mobile-friendly responsive layout for the delivery operations screens optimized for use on smartphones
9. WHEN a Delivery_Agent completes all stops on a Route, THE Platform SHALL display an end-of-day reconciliation summary showing: total delivered, total skipped, total failed, total returned, by Product_Variant
10. THE Platform SHALL allow Admin users to view delivery status for all Routes and agents for any date

### Requirement 8: Route Management

**User Story:** As an Admin, I want to create and organize delivery routes, so that deliveries are grouped geographically and assigned to agents efficiently.

#### Acceptance Criteria

1. WHEN an Admin creates a Route, THE Platform SHALL store the route name, description, and active status
2. THE Platform SHALL allow Admin users to assign Customers to a Route, with each Customer's primary address assigned to exactly one active Route
3. THE Platform SHALL allow Admin users to assign one or more Delivery_Agents to a Route
4. THE Platform SHALL allow Admin users to set the delivery sequence (stop order) for Customers within a Route by manual drag-and-drop or numeric ordering
5. WHEN a Customer is reassigned to a different Route, THE Platform SHALL update future Delivery_Orders to reflect the new Route assignment
6. THE Platform SHALL generate a printable Route_Manifest for each Route and date, listing all Delivery_Orders in sequence order
7. WHEN a Route is deactivated, THE Platform SHALL require all assigned Customers to be reassigned to other active Routes before allowing deactivation
8. THE Platform SHALL display a Route summary showing: number of assigned Customers, number of assigned agents, and total daily delivery quantity by Product_Variant

### Requirement 9: Billing and Invoicing

**User Story:** As Billing_Staff, I want to generate monthly invoices from delivered quantities, so that customers are billed accurately for what they received.

#### Acceptance Criteria

1. THE Platform SHALL support a configurable monthly Billing_Cycle with a definable start day (e.g., 1st of month or any other day)
2. WHEN Billing_Staff triggers invoice generation for a Billing_Cycle, THE Platform SHALL create an Invoice for each Customer who had delivered Delivery_Orders in that period
3. THE Platform SHALL calculate Invoice line items by multiplying delivered quantity by the Product_Variant price effective on each delivery date
4. WHEN a Product_Variant price changes mid-month, THE Platform SHALL apply the old price to deliveries before the effective date and the new price to deliveries on or after the effective date
5. THE Platform SHALL support manual Adjustments (credits and debits) on an Invoice with a required reason field
6. THE Platform SHALL support percentage-based and fixed-amount discounts on an Invoice
7. THE Platform SHALL carry forward any unpaid balance from the previous Billing_Cycle as an opening balance on the new Invoice
8. WHEN an Invoice is generated, THE Platform SHALL calculate: opening balance + current period charges - discounts + adjustments - payments received = closing balance
9. THE Platform SHALL generate a downloadable PDF for each Invoice containing: Customer details, billing period, itemized deliveries with dates and prices, adjustments, payments, and balance
10. THE Platform SHALL track Invoice payment status as: unpaid, partial, or paid
11. WHEN total payments against an Invoice equal or exceed the Invoice total, THE Platform SHALL automatically update the Invoice status to paid
12. THE Platform SHALL allow Billing_Staff to regenerate an Invoice for a Billing_Cycle to incorporate corrections, creating a new version while preserving the previous version

### Requirement 10: Payments and Collections

**User Story:** As Billing_Staff, I want to record customer payments, so that outstanding balances are tracked accurately.

#### Acceptance Criteria

1. WHEN Billing_Staff records a Payment, THE Platform SHALL require: Customer, amount, payment method, and payment date
2. THE Platform SHALL support the following payment methods: cash, UPI, bank transfer, card, and other (with a description field)
3. THE Platform SHALL allow partial Payments against an Invoice, updating the Invoice balance and status to partial
4. THE Platform SHALL support advance payments (payments exceeding current outstanding) by maintaining a credit balance on the Customer Ledger
5. WHEN a Customer has a credit balance and a new Invoice is generated, THE Platform SHALL automatically apply the credit balance to the new Invoice
6. THE Platform SHALL allow Delivery_Agents to record cash collections in the field, associating the collection with the agent for reconciliation
7. WHEN a Delivery_Agent records a collection, THE Platform SHALL include that collection in the agent's end-of-day collection handover summary
8. THE Platform SHALL provide a collection reconciliation screen for Admin users showing: total collected by each agent, total handed over, and any discrepancies
9. THE Platform SHALL display a Customer outstanding summary showing all Customers with unpaid or partially paid Invoices, sortable by outstanding amount and age

### Requirement 11: Reports and Analytics

**User Story:** As an Admin, I want to view operational and financial reports, so that I can monitor business performance and make informed decisions.

#### Acceptance Criteria

1. THE Platform SHALL provide a daily delivery quantity report showing total quantities delivered, grouped by Product_Variant
2. THE Platform SHALL provide a route-wise delivery report showing delivery counts and statuses (delivered, skipped, failed, returned) per Route for a selected date range
3. THE Platform SHALL provide a customer outstanding report listing all Customers with unpaid balances, showing Invoice details and aging
4. THE Platform SHALL provide a revenue report showing total billed revenue aggregated by day, week, and month for a selected date range
5. THE Platform SHALL provide a product sales report showing total quantities delivered per Product_Variant for a selected date range
6. THE Platform SHALL provide a missed deliveries report listing all Delivery_Orders with status skipped or failed, with reasons, for a selected date range
7. THE Platform SHALL provide a subscription change audit report listing all Subscription modifications (creates, pauses, resumes, cancellations, quantity changes) with timestamps and the user who made each change
8. WHEN a user requests a report export, THE Platform SHALL generate a downloadable CSV file containing the report data
9. THE Platform SHALL allow date range filtering on all reports
10. THE Platform SHALL display report data in tabular format with sorting and pagination

### Requirement 12: Notification System

**User Story:** As an Admin, I want to receive notifications about important system events, so that I can respond to issues promptly.

#### Acceptance Criteria

1. THE Platform SHALL provide an internal notification dashboard displaying alerts for all logged-in staff users
2. WHEN a significant system event occurs (daily generation failure, billing error, account lockout), THE Platform SHALL create an internal dashboard Notification for Super_Admin and Admin users
3. THE Platform SHALL support email notifications via a configurable SMTP_Provider using environment variables for host, port, credentials, and sender address
4. WHEN email notification is enabled and a critical event occurs, THE Platform SHALL send an email to configured recipient addresses
5. THE Platform SHALL provide a notification abstraction layer with a pluggable provider interface, allowing future addition of SMS or messaging providers without modifying core business logic
6. THE Platform SHALL allow Admin users to configure which event types trigger notifications and through which channels (dashboard, email)
7. WHEN a user views the notification dashboard, THE Platform SHALL display notifications in reverse chronological order with read/unread status
8. THE Platform SHALL mark notifications as read when a user clicks on them

### Requirement 13: Audit Logging

**User Story:** As a Super_Admin, I want a complete audit trail of important actions, so that I can review changes and investigate issues.

#### Acceptance Criteria

1. THE Platform SHALL record an Audit_Log entry for every create, update, and delete operation on: Customers, Products, Product_Variants, Subscriptions, Delivery_Orders, Invoices, Payments, Routes, and user accounts
2. EACH Audit_Log entry SHALL contain: timestamp, user ID, user role, action type, entity type, entity ID, and a summary of changes (old value and new value for updates)
3. THE Platform SHALL provide a searchable, filterable Audit_Log viewer accessible to Super_Admin and Admin users
4. THE Platform SHALL retain Audit_Log entries for a minimum of 365 days
5. THE Audit_Log SHALL be append-only; THE Platform SHALL prevent modification or deletion of Audit_Log entries through the application interface

### Requirement 14: Security and Data Protection

**User Story:** As a Super_Admin, I want the platform to follow security best practices, so that business data is protected from unauthorized access and common web vulnerabilities.

#### Acceptance Criteria

1. THE Platform SHALL validate and sanitize all user inputs on both client and server side to prevent XSS and SQL injection attacks
2. THE Platform SHALL enforce CSRF protection on all state-changing HTTP requests
3. THE Platform SHALL apply rate limiting of 100 requests per minute per IP address on authentication endpoints
4. THE Platform SHALL apply rate limiting of 1000 requests per minute per authenticated user on API endpoints
5. THE Platform SHALL store all configuration secrets (database credentials, SMTP credentials, session secrets) in environment variables, not in source code
6. THE Platform SHALL enforce HTTPS in production deployment via reverse proxy configuration
7. THE Platform SHALL provide a documented backup strategy including: automated daily PostgreSQL database dumps, configurable backup retention period, and a restore procedure
8. THE Platform SHALL use parameterized queries or an ORM for all database operations to prevent SQL injection

### Requirement 15: Deployment and Infrastructure

**User Story:** As a Super_Admin, I want to deploy the platform easily on a Linux server using Docker, so that I can run the system with minimal infrastructure setup.

#### Acceptance Criteria

1. THE Platform SHALL provide a docker-compose.yml file that starts all required services: application server, PostgreSQL database, and any background job workers
2. THE Platform SHALL provide database migration scripts that create and update the schema to the current version
3. THE Platform SHALL provide seed data scripts that populate the database with sample Customers, Products, Subscriptions, Routes, and staff accounts for demonstration
4. THE Platform SHALL provide a .env.example file documenting all required and optional environment variables with descriptions and default values
5. THE Platform SHALL provide a README file with step-by-step instructions for: local development setup, production deployment, running migrations, seeding data, and creating the first Super_Admin account
6. THE Platform SHALL use only open-source dependencies with licenses compatible with MIT, Apache 2.0, or BSD
7. WHEN the application starts, THE Platform SHALL run pending database migrations automatically before accepting requests
8. THE Platform SHALL include a health check endpoint at /api/health that returns the application and database connection status

### Requirement 16: User Interface

**User Story:** As a staff member, I want a clean, responsive web interface, so that I can perform my tasks efficiently on both desktop and mobile devices.

#### Acceptance Criteria

1. THE Platform SHALL provide a responsive web UI that adapts to screen widths from 320px (mobile) to 1920px (desktop)
2. THE Platform SHALL provide an Admin dashboard displaying: today's total deliveries, pending deliveries, total revenue this month, outstanding payments, and active customer count
3. THE Platform SHALL provide CRUD (create, read, update, delete/deactivate) screens for: Customers, Products, Product_Variants, Subscriptions, Routes, and staff user accounts
4. THE Platform SHALL provide a daily operations screen showing the Delivery_Sheet for a selected date with filtering by Route and Delivery_Agent
5. THE Platform SHALL provide a Subscription management screen showing active, paused, and cancelled Subscriptions with filtering by Customer, Product, and status
6. THE Platform SHALL provide billing and payment screens for Invoice viewing, Payment recording, and Ledger browsing
7. THE Platform SHALL provide a reports dashboard with navigation to all available reports
8. THE Platform SHALL provide a settings page for Super_Admin users to configure: Billing_Cycle start day, Cutoff_Time, holiday calendar, and notification preferences
9. THE Platform SHALL display form validation errors inline next to the relevant fields
10. THE Platform SHALL provide keyboard navigation support and appropriate ARIA labels for accessibility

### Requirement 17: Background Jobs and Scheduling

**User Story:** As an Admin, I want scheduled jobs to run automatically, so that daily orders are generated and monthly invoices are created without manual intervention.

#### Acceptance Criteria

1. THE Platform SHALL execute the daily Delivery_Order generation job at the configured schedule time each day
2. THE Platform SHALL support manual triggering of the daily Delivery_Order generation job by Super_Admin users
3. THE Platform SHALL execute the monthly Invoice generation job on the first day after each Billing_Cycle ends
4. THE Platform SHALL support manual triggering of the monthly Invoice generation job by Super_Admin or Billing_Staff users
5. IF a scheduled job fails, THEN THE Platform SHALL log the error with full context, create a Notification, and allow manual retry
6. THE Platform SHALL prevent concurrent execution of the same scheduled job to avoid duplicate Delivery_Orders or Invoices
7. THE Platform SHALL log the start time, end time, and result (success/failure with record counts) of each scheduled job execution

### Requirement 18: Inventory Lite Module (Post-MVP)

**User Story:** As an Admin, I want basic inventory tracking, so that I can reconcile daily stock with deliveries and identify wastage.

#### Acceptance Criteria

1. WHEN an Admin records daily inward stock, THE Platform SHALL store the Product_Variant, quantity received, date, and supplier name
2. THE Platform SHALL calculate daily closing stock as: opening stock + inward stock - delivered quantity - wastage/spoilage
3. WHEN an Admin records wastage or spoilage, THE Platform SHALL store the Product_Variant, quantity, date, and reason
4. THE Platform SHALL carry forward the closing stock of each day as the opening stock for the next day
5. THE Platform SHALL provide a daily stock reconciliation report showing: opening stock, inward, delivered, wasted, and closing stock per Product_Variant
6. IF the calculated closing stock is negative for any Product_Variant, THEN THE Platform SHALL display a warning alert to Admin users

### Requirement 19: Data Export and Printing

**User Story:** As an Admin, I want to export data and print documents, so that I can share information with stakeholders and maintain physical records.

#### Acceptance Criteria

1. WHEN a user requests a CSV export from any report or data list, THE Platform SHALL generate a CSV file with appropriate column headers and UTF-8 encoding
2. THE Platform SHALL provide a print-friendly layout for Invoices, Route_Manifests, and Delivery_Sheets
3. THE Platform SHALL generate Invoice PDFs using an open-source PDF library without requiring external paid services
4. WHEN a user requests a PDF download, THE Platform SHALL generate the PDF server-side and return it as a downloadable file

### Requirement 20: Holiday and Exception Management

**User Story:** As an Admin, I want to manage holidays and delivery exceptions, so that the system correctly handles non-delivery days.

#### Acceptance Criteria

1. THE Platform SHALL provide a holiday calendar where Admin users can add system-wide holidays with a date and description
2. THE Platform SHALL allow Admin users to add Route-specific non-delivery days
3. WHEN a holiday or Route-specific non-delivery day is configured, THE Platform SHALL exclude affected Subscriptions from Delivery_Order generation for that date
4. THE Platform SHALL display configured holidays and non-delivery days on the daily operations screen
5. WHEN an Admin deletes a future holiday, THE Platform SHALL allow regeneration of Delivery_Orders for that date if the daily generation job has already run

### Requirement 21: Customer Ledger and Financial History

**User Story:** As Billing_Staff, I want to view a complete financial history for each customer, so that I can resolve billing inquiries and track payment patterns.

#### Acceptance Criteria

1. THE Platform SHALL maintain a Ledger for each Customer recording all financial transactions: Invoice charges, Payments, Adjustments, and credit applications
2. EACH Ledger entry SHALL contain: date, transaction type, reference (Invoice ID or Payment ID), debit amount, credit amount, and running balance
3. THE Platform SHALL display the Customer Ledger in chronological order with the current outstanding balance prominently shown
4. WHEN a billing correction is needed, THE Platform SHALL allow Billing_Staff to create an Adjustment entry with a required reason, which updates the Customer's running balance
5. THE Platform SHALL provide a Ledger statement export as PDF for a selected date range per Customer
