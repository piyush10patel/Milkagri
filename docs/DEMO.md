# Recruiter Demo Guide

This guide is designed for a 5-10 minute walkthrough of MilkAgri with a recruiter, interviewer, or project reviewer.

## Demo Goal

Show that MilkAgri is more than a CRUD app. It models a real business workflow across customers, subscriptions, logistics, billing, field collections, procurement, permissions, reports, and deployment.

## Suggested Opening

"MilkAgri is a full-stack operations platform for a subscription-based dairy delivery business. I built it to replace spreadsheets and manual reconciliation with a structured workflow: customers subscribe to products, routes generate daily delivery work, field agents collect payments, and admins can review invoices, ledgers, milk procurement, and reports."

## Quick Access

For a controlled demo environment, open:

```text
/register
```

Create an account, then the app signs you in automatically.

Important: demo registration grants `super_admin` access so reviewers can see the full application. Remove or gate public registration before using this as a real public production service.

## Walkthrough Script

### 1. Dashboard

Start at the dashboard to show the application scope. Point out that the sidebar is permission-aware and organizes the product by real operational areas.

What to highlight:

- Dashboard-first navigation
- Responsive app shell
- Role-aware menu visibility
- Notification entry point

### 2. Customers and Subscriptions

Open `Customers`, then a customer detail page if demo data is seeded.

What to highlight:

- Customer profile, delivery notes, addresses, status, and ledger entry points
- Subscription workflows for recurring milk delivery
- Product, quantity, delivery session, and frequency concepts

### 3. Routes and Delivery Operations

Open `Routes`, `Route Map`, and `Deliveries`.

What to highlight:

- Route planning and stop organization
- Daily delivery manifest
- GPS/live tracking page as an operational extension
- Missed or adjusted delivery handling

### 4. Billing and Payments

Open `Billing`, `Payments`, and a customer ledger.

What to highlight:

- Invoice generation and detail views
- Outstanding balances and payment collection
- Ledger-based reconciliation instead of spreadsheet totals
- Separation between recorded payments and field collections

### 5. Milk Collection and Agent Collections

Open `Milk Collection` and the `Collections` section.

What to highlight:

- Village/farmer milk procurement flow
- Collection routes and vehicle loads
- Agent assignments, remittances, balances, and daily collection work

### 6. Reports and Admin Controls

Open `Reports`, `Users`, `Settings`, `Permission Matrix`, and `Audit Log`.

What to highlight:

- Reports for revenue, delivery, outstanding balances, product sales, and subscription changes
- RBAC with database-backed permissions
- Audit log and settings modules
- Admin bootstrap and deployment readiness

## Technical Talking Points

- Full TypeScript implementation across React and Express.
- Prisma models and migrations for a complex relational domain.
- Session auth, bcrypt password hashing, CSRF protection, Helmet, and login lockout.
- Background jobs for daily order and invoice generation.
- Redis-backed sessions and optional BullMQ workers.
- Lazy-loaded frontend routes for better bundle behavior.
- Docker, Render, Neon, and Upstash deployment path.
- Focused Vitest coverage for services, middleware, validation, routing, pricing, and billing.

## Strong Interview Angles

- "I treated the app as an operations system, not just a UI."
- "The data model is the center of the project because billing, delivery, and subscriptions all depend on consistent state."
- "I built RBAC and auditability because staff roles matter in a real business."
- "I added a controlled demo registration flow so reviewers can explore the authenticated app without needing me to create accounts manually."
- "I kept deployment realistic: one production Node service can serve both API and frontend, with managed Postgres and Redis."

## Before Presenting

Run:

```bash
npm run build
```

Then verify:

- `/register` opens and creates a demo account.
- The dashboard loads after registration.
- Seed data exists if you want a richer walkthrough.
- No real credentials are present in `.env.example`, docs, screenshots, or commit history.
