# MilkAgri

MilkAgri is a full-stack dairy delivery operations platform built to manage the day-to-day workflow of a subscription-based milk business. It covers customer onboarding, product pricing, recurring subscriptions, route planning, daily delivery execution, milk procurement, field collections, billing, payments, reports, inventory, notifications, and role-based staff access.

The project is intentionally broad: it demonstrates end-to-end product thinking, relational data modeling, authenticated workflows, background jobs, operational dashboards, and a production deployment path.

## Why This Project Matters

Small dairy distributors often run on spreadsheets, phone calls, and manual reconciliation. MilkAgri turns that workflow into a structured web application:

- Admins manage customers, products, routes, pricing, users, permissions, and reports.
- Operations teams generate and track daily milk delivery orders.
- Field teams record deliveries, payments, remittances, and milk collections.
- Billing teams generate invoices, track outstanding balances, and review ledgers.
- Owners get a single dashboard for revenue, delivery, collection, and customer activity.

## Product Highlights

| Area | What it supports |
|---|---|
| Customer CRM | Customer profiles, addresses, status, delivery notes, ledgers |
| Subscriptions | Recurring delivery plans, quantities, sessions, frequencies, holds, changes |
| Routing | Delivery routes, route maps, stop ordering, GPS tracking, route reports |
| Daily operations | Order generation, delivery manifests, milk summaries, missed delivery tracking |
| Billing | Invoice generation, invoice detail views, payments, outstanding balances |
| Milk procurement | Village collections, farmers, collection routes, vehicle loads |
| Agent collections | Agent assignments, field collection work, remittances, balances |
| Admin controls | Users, role permissions, audit logs, settings, notifications |
| Reporting | Revenue, product sales, daily delivery, route delivery, subscription changes |

## Technical Highlights

- TypeScript across client and server.
- React 19, Vite, Tailwind CSS, React Router, and TanStack Query on the frontend.
- Express, Prisma, PostgreSQL, Redis, BullMQ, and session-based auth on the backend.
- Database-driven RBAC with a super-admin bypass and permission matrix.
- CSRF protection for state-changing requests.
- bcrypt password hashing and login lockout handling.
- Prisma migrations for a substantial relational domain model.
- Background jobs for recurring order and invoice generation.
- Docker Compose, Render, Neon Postgres, and Upstash Redis deployment support.
- Vitest coverage for core pricing, routing, billing, validation, middleware, and service logic.
- PWA-ready client with service worker and app icons.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, React Router, TanStack Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Queue and cache | Redis, BullMQ |
| Auth and security | express-session, bcrypt, CSRF middleware, Helmet, RBAC |
| Testing | Vitest, fast-check |
| Deployment | Docker, Docker Compose, Nginx, Render |

## Demo Access

The app includes a public `/register` page so a recruiter or reviewer can create a demo account and immediately explore the authenticated dashboard.

Demo signups are isolated from live operational records. They get the full product surface for review, but API reads return sandbox sample data and state-changing demo requests are accepted without modifying the real database. Existing seeded/admin logins continue to use the real database exactly as before.

For a guided walkthrough, see [docs/DEMO.md](docs/DEMO.md).

## Local Development

### Prerequisites

- Node.js 20 or newer
- Docker Desktop, or local PostgreSQL and Redis instances
- npm

### 1. Install dependencies

```bash
git clone https://github.com/piyush10patel/Milkagri.git
cd Milkagri
npm ci
```

### 2. Configure environment

```bash
cp .env.example .env
```

For local Docker services, set at least:

```dotenv
POSTGRES_PASSWORD=local-password
DATABASE_URL=postgresql://milkdelivery:local-password@localhost:5432/milkdelivery
REDIS_URL=redis://localhost:6379
SESSION_SECRET=replace-with-a-long-random-secret
```

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d postgres redis
```

### 4. Apply migrations and seed demo data

```bash
npm run db:migrate
npm run db:seed
```

The seed script creates sample operational data. If seed passwords are not provided, it generates random passwords and prints them once in the console.

For predictable local demo credentials:

```bash
SEED_ADMIN_PASSWORD=demo-admin-password SEED_AGENT_PASSWORD=demo-agent-password npm run db:seed
```

On Windows PowerShell:

```powershell
$env:SEED_ADMIN_PASSWORD="demo-admin-password"
$env:SEED_AGENT_PASSWORD="demo-agent-password"
npm run db:seed
```

### 5. Run the app

Use two terminals:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

Default local URLs:

- Frontend: `http://localhost:5173`
- API health check: `http://localhost:3000/api/health`

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev:server` | Start the Express API in development |
| `npm run dev:client` | Start the Vite frontend in development |
| `npm run build` | Build client and server |
| `npm start` | Run the built production server |
| `npm test` | Run the Vitest suite |
| `npm run db:migrate` | Apply pending Prisma migrations |
| `npm run db:migrate:dev` | Create and apply a development migration |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run bootstrap:admin` | Create or reset the first production super admin |

## Project Structure

```text
deploy/             Deployment notes and host-specific templates
docs/               Recruiter/demo, architecture, and deployment documentation
prisma/             Prisma schema, migrations, and seed data
scripts/            Backup, restore, icon generation, and admin bootstrap helpers
src/client/         React frontend application
src/server/         Express API, modules, middleware, jobs, and shared libraries
```

## Documentation

- [docs/DEMO.md](docs/DEMO.md) - recruiter walkthrough and demo flow
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - system design and module overview
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - deployment checklist and environment notes
- [deploy/render-free/README.md](deploy/render-free/README.md) - Render free-tier deployment guide

## Quality Checks

Run the production build before presenting or deploying:

```bash
npm run build
```

The repository also includes Vitest coverage for pricing, routing helpers, billing, payments, validation, permissions, middleware, and selected property-based route checks. Run it during development with:

```bash
npm test
```

## Deployment Summary

For a simple hosted setup:

- Render Web Service for the Node app
- Neon Postgres for the database
- Upstash Redis for sessions and optional background jobs

The production server serves both the API and the built React frontend from one Node process. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the general checklist and [deploy/render-free/README.md](deploy/render-free/README.md) for the Render-specific version.

## Security Notes

- Never commit a populated `.env` file.
- Rotate any credential that was ever committed or shared.
- Public registration creates sandboxed reviewer accounts; create real staff accounts through protected user management or `npm run bootstrap:admin`.
- Use strong `SESSION_SECRET`, database, Redis, and admin credentials in every environment.
- Keep demo seed data out of real customer-facing deployments.

## License

MIT
