# Milk Delivery Platform

Self-hosted web application for running a milk and dairy delivery business: customers, subscriptions, routes, daily orders, delivery execution, billing, payments, reporting, inventory, and milk collection.

Built with Express.js, React, PostgreSQL, Redis, and Prisma.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js, TypeScript |
| Frontend | React, Vite, Tailwind CSS |
| Database | PostgreSQL, Prisma ORM |
| Queue / Jobs | Redis, BullMQ |
| Auth | express-session, bcrypt |
| Testing | Vitest |
| Deployment | Docker, Docker Compose, Nginx |

## Local Development

### 1. Install

```bash
git clone <repository-url>
cd milk-delivery-platform
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Set values in `.env`. At minimum you will need:

```dotenv
DATABASE_URL=postgresql://<db-user>:<db-password>@localhost:5432/<db-name>
REDIS_URL=redis://localhost:6379
SESSION_SECRET=<generate-a-random-secret>
POSTGRES_PASSWORD=<set-a-strong-password>
```

Notes:
- Do not commit `.env`
- Use strong unique secrets in every environment
- Rotate any secrets that were previously committed or shared

### 3. Start local services

```bash
docker compose up -d postgres redis
```

### 4. Migrate and seed

```bash
npx prisma migrate deploy
npm run db:seed
```

The seed script creates sample users and demo operational data. It does not embed fixed passwords in the repository.

If you want predictable demo passwords for a local run, set them before seeding:

```bash
SEED_ADMIN_PASSWORD=<your-demo-admin-password>
SEED_AGENT_PASSWORD=<your-demo-agent-password>
npm run db:seed
```

If these variables are not set, the seed script generates random passwords and prints them once in the console.

### 5. Start the app

Run in two terminals:

```bash
npm run dev:server
```

```bash
npm run dev:client
```

Default local URLs:
- API: `http://localhost:3000`
- App: `http://localhost:5173`

## Production Deployment

### 1. Prepare environment

```bash
cp .env.example .env
```

Set production values for all required variables before starting containers.

Key variables:

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `SESSION_SECRET` | Yes | Session signing secret |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | No | Email settings |
| `SMS_PROVIDER_URL` / `SMS_API_KEY` | No | SMS integration |
| `WEBHOOK_NOTIFICATION_URL` | No | Outbound webhook target |

### 2. Start services

```bash
docker compose up -d --build
```

### 3. Seed optional demo data

```bash
docker compose exec app npx tsx prisma/seed.ts
```

Use this only for non-production/demo environments unless you explicitly want sample data.

## Database and Backups

### Migrations

```bash
npm run db:migrate
```

### Prisma Studio

```bash
npm run db:studio
```

### Backup

```bash
docker compose exec postgres pg_dump -U <db-user> -Fc <db-name> > backup.dump
```

### Restore

```bash
./scripts/restore.sh <path-to-backup>
```

Make sure `DATABASE_URL` points to the correct target database before restoring.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev:server` | Start backend in development |
| `npm run dev:client` | Start frontend in development |
| `npm run build` | Build client and server |
| `npm test` | Run tests |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:migrate:dev` | Create a development migration |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |

## Security Notes

- `.env` and other local secret files should stay out of version control
- Never publish real production credentials in docs, scripts, or screenshots
- If secrets were already pushed, rotate them and clean git history before treating the repo as public-safe
- Review seeded demo data before using it in shared or customer-facing environments

## Project Structure

```text
prisma/         Database schema, migrations, seed
scripts/        Backup and restore helpers
src/server/     Express API
src/client/     React application
```

## License

MIT
