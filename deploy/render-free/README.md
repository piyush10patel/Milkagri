# Render Free Deployment Checklist

This guide is for deploying the app with:

- Render Web Service
- Neon Postgres
- Upstash Redis

It assumes you want a clean production deployment with no demo seed data.

## 1. Create infrastructure

### Neon

Create a Postgres project in Neon and copy the pooled or direct connection string.

Use:

- `DATABASE_URL=<Neon connection string>`

Recommended:

- Keep `sslmode=require` in the URL

### Upstash Redis

Create a Redis database in Upstash and copy the Redis connection string.

Use:

- `REDIS_URL=<Upstash Redis URL>`

## 2. Create the Render web service

Create a new Web Service from this repository.

Use these settings:

- Runtime: `Node`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

If Render detects [render.yaml](/J:/Milkagri/render.yaml), you can also deploy it as a Blueprint.

## 3. Set Render environment variables

Use [env.template](/J:/Milkagri/deploy/render-free/env.template) as the source of truth.

Required values:

| Variable | What to set |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `ENABLE_BACKGROUND_JOBS` | `false` |
| `CORS_ORIGIN` | `https://<your-render-service>.onrender.com` |
| `DATABASE_URL` | Neon connection string |
| `REDIS_URL` | Upstash Redis URL |
| `SESSION_SECRET` | Long random string |

Optional values:

| Variable | When needed |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email notifications |
| `SMS_PROVIDER_URL`, `SMS_API_KEY` | SMS integration |
| `WEBHOOK_NOTIFICATION_URL` | Outbound webhook notifications |
| `DAILY_ORDER_CRON`, `DAILY_INVOICE_CRON` | Only if background jobs are enabled |

## 4. Deploy

Trigger the first deployment from Render.

The server will:

- start on `PORT`
- serve the built frontend
- run `prisma migrate deploy` on startup in production

## 5. Create the first super admin

### Option A: recommended on Render free

If Render Shell is unavailable on your plan, bootstrap the first admin through startup:

Set these temporary environment variables in Render:

| Variable | Value |
|---|---|
| `AUTO_BOOTSTRAP_ADMIN` | `true` |
| `ADMIN_EMAIL` | Your admin email |
| `ADMIN_PASSWORD` | Strong admin password |
| `ADMIN_NAME` | Your display name |

Then redeploy once.

After the deploy finishes:

- log in with the configured admin email and password
- immediately change or remove `AUTO_BOOTSTRAP_ADMIN`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`
- redeploy again so credentials are no longer present in service env

### Option B: local bootstrap

If your machine can connect to the production database, run:

```powershell
$env:DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
$env:ADMIN_EMAIL="owner@example.com"
$env:ADMIN_PASSWORD="<strong-password>"
$env:ADMIN_NAME="Owner"
npm run bootstrap:admin
```

This will create or reset the first `super_admin` account.

## 6. First login check

Open:

- `https://<your-render-service>.onrender.com`

Then:

- log in with the admin you bootstrapped
- verify `/api/health` returns OK
- create one customer and one route
- generate a test order manually

## 7. Recommended free-tier settings

For Render free:

- keep `ENABLE_BACKGROUND_JOBS=false`
- generate orders and invoices manually from the app

Reason:

- free services sleep
- sleeping workers make BullMQ schedules unreliable

## 8. If deployment fails

Check these first:

1. `DATABASE_URL` must point to Postgres and be reachable from Render.
2. `REDIS_URL` must be a real Redis URL, not localhost.
3. `SESSION_SECRET` must be set.
4. `CORS_ORIGIN` must match the actual public app URL exactly.
5. Prisma migrations must succeed on startup.

## 9. Production notes for this repo

- Secure cookies require proxy trust in production; this is already handled in [index.ts](/J:/Milkagri/src/server/index.ts)
- Missing required env vars now fail fast in production
- Background jobs are optional and should stay off on free hosting
- The app serves frontend and API from one Node process
