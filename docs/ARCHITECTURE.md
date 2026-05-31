# Architecture

MilkAgri is a full-stack TypeScript application with a React frontend, an Express API, PostgreSQL persistence through Prisma, and Redis for sessions and optional background work.

## System Overview

```text
React/Vite client
  |
  | /api requests with credentials and CSRF tokens
  v
Express API
  |
  | Prisma Client
  v
PostgreSQL

Express API
  |
  | RedisStore / BullMQ
  v
Redis
```

In production, the Express server serves both:

- `/api/*` backend routes
- the built React app from `dist/client`

## Frontend

Location: `src/client`

Key responsibilities:

- Authenticated app shell and route protection
- Lazy-loaded page routes
- Permission-aware navigation
- Form-heavy operational workflows
- Dashboards, reports, tables, modals, and map-driven route pages
- API access through a shared CSRF-aware fetch wrapper

Important files:

| File | Purpose |
|---|---|
| `src/client/App.tsx` | Route tree, auth gates, lazy page loading |
| `src/client/hooks/useAuth.ts` | Session state, login, registration, logout |
| `src/client/hooks/usePermissions.ts` | Role permission loading |
| `src/client/lib/api.ts` | Fetch wrapper with credentials and CSRF handling |
| `src/client/components/Layout.tsx` | Main app shell and navigation |

## Backend

Location: `src/server`

The API is organized by business module. Each module generally contains:

- `*.routes.ts` for route definitions and middleware
- `*.controller.ts` for request handling when needed
- `*.service.ts` for domain logic
- `*.types.ts` for schemas and TypeScript types
- focused tests where business logic is substantial

Representative modules:

| Module | Responsibility |
|---|---|
| `auth` | Login, demo registration, logout, session user |
| `users` | Staff account management |
| `permissions` | RBAC permission matrix |
| `customers` | Customer profiles and addresses |
| `subscriptions` | Recurring delivery plans |
| `orders` | Daily delivery order generation and management |
| `delivery` | Delivery execution workflows |
| `routes` | Route planning and map data |
| `billing` | Invoice generation and billing cycles |
| `payments` | Payment recording and outstanding balances |
| `ledger` | Customer ledger entries |
| `milk-collections` | Procurement-side village and farmer collections |
| `agent-collections` | Field collection work |
| `agent-remittances` | Agent cash handoff and reconciliation |
| `reports` | Operational and financial reports |
| `notifications` | In-app and provider-backed notifications |

## Data Layer

Location: `prisma`

Prisma owns:

- schema definition
- database migrations
- seed data
- generated Prisma Client

The schema includes operational entities for users, customers, addresses, products, product variants, prices, subscriptions, route stops, delivery orders, invoices, payments, ledgers, holidays, audit logs, notifications, milk collection, inventory, and agent remittances.

## Authentication and Authorization

Authentication is session-based:

- `express-session` stores the signed session cookie.
- Redis is used as the production session store unless disabled.
- Passwords are hashed with bcrypt.
- Failed login attempts are tracked and can temporarily lock an account.

Authorization is permission-based:

- `super_admin` bypasses permission checks.
- Other roles are checked against `role_permissions`.
- Permissions are cached in memory with invalidation on updates.
- The frontend uses the same permission model to hide or show navigation entries.

## CSRF and Request Flow

State-changing client requests go through `src/client/lib/api.ts`.

The wrapper:

1. Fetches a CSRF token from `/api/csrf-token` when needed.
2. Sends credentials with every request.
3. Attaches the token for `POST`, `PUT`, `PATCH`, and `DELETE`.
4. Refreshes and retries once if the token is rejected.

## Background Jobs

Location: `src/server/jobs`

Background jobs use BullMQ and Redis for:

- daily delivery order generation
- daily invoice generation
- monthly invoice generation

On free-tier hosts where services sleep, background jobs can be disabled with:

```dotenv
ENABLE_BACKGROUND_JOBS=false
```

## Deployment Shape

Recommended hosted setup:

- Render Web Service for the Node app
- Neon Postgres for the database
- Upstash Redis for sessions and queues

Production startup:

1. Build frontend and backend.
2. Run `npm start`.
3. Server applies pending Prisma migrations in production.
4. Server exposes `/api/health`.
5. Server serves React app for non-API routes.

## Testing Strategy

The test suite focuses on high-risk backend behavior and reusable client utilities:

- pricing calculations
- route formatting and waypoint helpers
- billing and payment services
- validation and sanitization
- middleware behavior
- authorization logic
- route property-based tests

Run:

```bash
npm test
npm run build
```
