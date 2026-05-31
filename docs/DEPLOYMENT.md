# Deployment

MilkAgri can run locally with Docker Compose or as a hosted Node service backed by managed PostgreSQL and Redis.

## Production Model

The production build creates:

- `dist/server` from the TypeScript Express API
- `dist/client` from the Vite React app

The Express server serves the built frontend in production, so a single Node web service is enough for both API and UI.

## Required Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | Yes | Use `production` in deployed environments |
| `PORT` | Yes | Render commonly injects this automatically |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes unless Redis sessions are disabled | Redis connection string |
| `SESSION_SECRET` | Yes | Long random string |
| `CORS_ORIGIN` | Recommended | Public app URL |
| `ENABLE_BACKGROUND_JOBS` | Recommended | Use `false` on sleeping free-tier hosts |
| `ENABLE_PWA` | Optional | Set `true` to enable service worker generation |

Optional integrations:

- SMTP variables for email notifications
- SMS provider variables
- webhook notification URL
- VAPID keys for push notifications

## Local Docker Compose

Start infrastructure only:

```bash
docker compose up -d postgres redis
```

Run the app in development:

```bash
npm run dev:server
npm run dev:client
```

Run the production-style stack:

```bash
docker compose up -d --build
```

## Database Setup

Apply migrations:

```bash
npm run db:migrate
```

Seed demo data:

```bash
npm run db:seed
```

For a real production database, skip demo seeding and bootstrap the first admin instead.

## First Admin Bootstrap

Set:

```dotenv
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD=replace-with-a-strong-password
ADMIN_NAME=Owner
```

Then run:

```bash
npm run bootstrap:admin
```

For hosted environments without shell access, temporary startup bootstrap is supported:

```dotenv
AUTO_BOOTSTRAP_ADMIN=true
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD=replace-with-a-strong-password
ADMIN_NAME=Owner
```

Deploy once, log in, then remove the temporary bootstrap variables and deploy again.

## Render, Neon, and Upstash

Recommended free or low-cost hosted setup:

1. Create a Neon Postgres project.
2. Create an Upstash Redis database.
3. Create a Render Web Service from this repository.
4. Use `npm ci && npm run build` as the build command.
5. Use `npm start` as the start command.
6. Set `/api/health` as the health check path.
7. Set `ENABLE_BACKGROUND_JOBS=false` for sleeping free-tier services.

This repository also includes:

- `render.yaml`
- `deploy/render-free/README.md`
- `deploy/render-free/env.template`

## Pre-Deploy Checklist

Before deploying or presenting:

```bash
npm run build
```

Confirm:

- `.env` is not committed.
- Real secrets are not present in docs or config templates.
- `DATABASE_URL` points at the intended database.
- `SESSION_SECRET` is set and strong.
- `CORS_ORIGIN` matches the deployed app URL.
- Public demo registration is acceptable for the target environment.

## Backups

Docker Compose includes a backup helper service, and scripts are available in `scripts/`.

Manual backup example:

```bash
docker compose exec postgres pg_dump -U milkdelivery -Fc milkdelivery > backup.dump
```

Restore:

```bash
./scripts/restore.sh backup.dump
```
