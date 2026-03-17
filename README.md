# Milk Delivery Platform

A self-hosted, open-source web application for managing the full lifecycle of a milk/dairy delivery business — customer onboarding, product catalog, recurring subscriptions, daily delivery operations, route management, billing, payment collection, reporting, and administration.

Built with Express.js, React, PostgreSQL, and Redis. Deployed via Docker Compose on a single Linux server with zero dependency on paid SaaS providers.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20, Express.js, TypeScript |
| Frontend | React 18, Vite, Tailwind CSS, Shadcn/ui |
| Database | PostgreSQL 16, Prisma ORM |
| Background Jobs | BullMQ + Redis 7 |
| Auth | express-session, passport-local, bcrypt |
| PDF | PDFKit |
| Email | Nodemailer (SMTP) |
| Testing | Vitest, fast-check (property-based) |
| Deployment | Docker, Docker Compose, Nginx |

## Prerequisites

- [Node.js 20 LTS](https://nodejs.org/) (for local development)
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (for production)
- Git

## Local Development Setup

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd milk-delivery-platform
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```dotenv
DATABASE_URL=postgresql://milkdelivery:yourpassword@localhost:5432/milkdelivery
REDIS_URL=redis://localhost:6379
SESSION_SECRET=<random-string>
CSRF_SECRET=<random-string>
POSTGRES_PASSWORD=yourpassword
```

Generate secrets with:

```bash
openssl rand -hex 32
```

### 3. Start PostgreSQL and Redis

Using Docker (recommended):

```bash
docker compose up -d postgres redis
```

Or use locally installed instances and update `DATABASE_URL` / `REDIS_URL` accordingly.

### 4. Run database migrations and seed

```bash
npx prisma migrate deploy
npm run db:seed
```

### 5. Start development servers

In two separate terminals:

```bash
# Terminal 1 — API server (auto-reloads on changes)
npm run dev:server

# Terminal 2 — React frontend (Vite dev server with HMR)
npm run dev:client
```

The API runs on `http://localhost:3000` and the Vite dev server on `http://localhost:5173` (proxied to the API).

### 6. Run tests

```bash
npm test
```

## Production Deployment

### 1. Prepare the server

Ensure Docker and Docker Compose are installed on your Linux server.

### 2. Configure environment

```bash
cp .env.example .env
```

Set all required values in `.env`:

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `SESSION_SECRET` | Yes | Random string for session signing |
| `CSRF_SECRET` | Yes | Random string for CSRF tokens |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Auto | Defaults to `redis://redis:6379` |
| `NODE_ENV` | Auto | Set to `production` by Docker Compose |
| `PORT` | No | App port (default: `3000`) |
| `SMTP_HOST` | No | SMTP server for email notifications |
| `SMTP_PORT` | No | SMTP port (default: `587`) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | Sender email address |
| `DAILY_ORDER_CRON` | No | Cron for daily order generation (default: `0 2 * * *`) |
| `MONTHLY_INVOICE_CRON` | No | Cron for monthly invoicing (default: `0 3 1 * *`) |
| `BILLING_CYCLE_START_DAY` | No | Day of month billing starts (default: `1`) |
| `CUTOFF_TIME` | No | Subscription change cutoff (default: `22:00`) |
| `HTTP_PORT` | No | Nginx HTTP port (default: `80`) |
| `HTTPS_PORT` | No | Nginx HTTPS port (default: `443`) |
| `SSL_CERT_DIR` | No | Path to SSL cert/key files (default: `./ssl`) |
| `BACKUP_DIR` | No | Backup storage directory (default: `./backups`) |
| `BACKUP_RETENTION_DAYS` | No | Days to keep backups (default: `30`) |

### 3. Set up SSL (optional but recommended)

Place your SSL certificate and key in the `ssl/` directory:

```
ssl/
├── cert.pem
└── key.pem
```

### 4. Build and start

```bash
docker compose up -d --build
```

This starts all services:
- **postgres** — PostgreSQL 16 database
- **redis** — Redis 7 for sessions and job queues
- **app** — Express API server (auto-runs migrations on startup)
- **worker** — BullMQ background job processor
- **nginx** — Reverse proxy with HTTPS termination
- **backup** — Automated daily database backups via cron

### 5. Seed the database (first run only)

```bash
docker compose exec app npx tsx prisma/seed.ts
```

### 6. Verify

```bash
curl http://localhost/api/health
```

Should return `{"status":"ok"}` with database connection info.

## Database Migrations

Migrations run automatically on app startup (`prisma migrate deploy` in the Docker CMD). For manual control:

```bash
# Deploy pending migrations
npm run db:migrate

# Create a new migration during development
npm run db:migrate:dev

# Open Prisma Studio (visual DB browser)
npm run db:studio
```

## Seeding Data

The seed script (`prisma/seed.ts`) populates the database with sample data for demonstration:

```bash
npm run db:seed
```

This creates:
- Staff accounts (Super Admin, Admin, Delivery Agents, Billing Staff)
- Sample customers with addresses
- Products (Cow Milk, Buffalo Milk, Curd) with variants and prices
- Sample subscriptions (daily, alternate-day, custom weekday)
- Two delivery routes with customer and agent assignments
- System-wide holidays
- Default system settings

## Creating the First Super Admin Account

After seeding, a Super Admin account is available:

| Field | Value |
|---|---|
| Email | `admin@milkdelivery.local` |
| Password | `Admin@123` |

**Change this password immediately after first login.**

Other seeded accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `manager@milkdelivery.local` | `Admin@123` |
| Delivery Agent | `agent1@milkdelivery.local` | `Agent@123` |
| Delivery Agent | `agent2@milkdelivery.local` | `Agent@123` |
| Billing Staff | `billing@milkdelivery.local` | `Admin@123` |

If you prefer to create a Super Admin without seeding, insert directly via Prisma:

```bash
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('YourSecurePassword', 10);
  await prisma.user.create({
    data: {
      email: 'you@example.com',
      passwordHash: hash,
      name: 'Your Name',
      role: 'super_admin',
    },
  });
  console.log('Super Admin created.');
  await prisma.\$disconnect();
})();
"
```

## Backup and Restore

### Automated Backups

The `backup` service in Docker Compose runs a daily cron job at 2:00 AM that:
- Creates a compressed PostgreSQL dump in `./backups/`
- Removes backups older than `BACKUP_RETENTION_DAYS` (default: 30)

Backup files are named `milkdelivery_YYYYMMDD_HHMMSS.dump`.

### Manual Backup

```bash
# From the host (Docker)
docker compose exec postgres pg_dump -U milkdelivery -Fc milkdelivery > backup.dump

# Or using the backup script directly
DATABASE_URL="postgresql://milkdelivery:password@localhost:5432/milkdelivery" ./scripts/backup.sh
```

### Restore

```bash
# Set DATABASE_URL and run the restore script
DATABASE_URL="postgresql://milkdelivery:password@localhost:5432/milkdelivery" \
  ./scripts/restore.sh ./backups/milkdelivery_20260315_020000.dump
```

The restore script will prompt for confirmation before overwriting data. It uses `pg_restore` with `--clean --single-transaction` for safe, atomic restores.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev:server` | Start API server with auto-reload |
| `npm run dev:client` | Start Vite dev server with HMR |
| `npm run build` | Build client and server for production |
| `npm test` | Run all tests (Vitest) |
| `npm run db:migrate` | Deploy pending migrations |
| `npm run db:migrate:dev` | Create new migration (development) |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
├── prisma/                  # Database schema, migrations, seed
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── scripts/                 # Backup and restore scripts
├── src/
│   ├── server/              # Express API
│   │   ├── modules/         # Feature modules (auth, customers, billing, etc.)
│   │   ├── middleware/       # Auth, RBAC, CSRF, rate limiting, error handling
│   │   ├── jobs/            # BullMQ background job processors
│   │   ├── lib/             # Shared utilities (pricing, pagination, PDF, etc.)
│   │   └── index.ts         # App entry point
│   └── client/              # React SPA
│       ├── pages/           # Route pages
│       ├── components/      # Shared components
│       ├── hooks/           # Custom React hooks
│       └── lib/             # API client utilities
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
└── .env.example
```

## License

MIT
