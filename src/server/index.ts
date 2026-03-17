import 'dotenv/config';
import { execSync } from 'node:child_process';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { csrfProtection, csrfTokenProvider } from './middleware/csrf.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import customersRoutes from './modules/customers/customers.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes.js';
import holidaysRoutes from './modules/holidays/holidays.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import routesRoutes from './modules/routes/routes.routes.js';
import deliveryRoutes from './modules/delivery/delivery.routes.js';
import billingRoutes from './modules/billing/billing.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import ledgerRoutes from './modules/ledger/ledger.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import { startWorker, registerSchedules } from './jobs/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Database client
// ---------------------------------------------------------------------------
export const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Redis client (used for sessions; also available for BullMQ elsewhere)
// ---------------------------------------------------------------------------
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // required by BullMQ
  lazyConnect: true,          // don't connect until first use
});

// ---------------------------------------------------------------------------
// 1. Security headers
// ---------------------------------------------------------------------------
app.use(helmet());

// ---------------------------------------------------------------------------
// 2. CORS
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// 3. Body parsing
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// 4. Session management (Redis store)
// ---------------------------------------------------------------------------
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-me';

app.use(
  session({
    store: new RedisStore({ client: redis }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'milk.sid',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// ---------------------------------------------------------------------------
// 5. CSRF protection — applied per-route on state-changing endpoints later.
//    The csurf middleware will be mounted on specific routers that need it
//    (POST/PUT/PATCH/DELETE) rather than globally, so GET requests for the
//    CSRF token can work without a token already being present.
// ---------------------------------------------------------------------------
// CSRF middleware is created and exported for use in route-level mounting.
// See src/server/middleware/csrf.ts (created in task 3.1).

// ---------------------------------------------------------------------------
// 6. Rate limiting (API-wide)
// ---------------------------------------------------------------------------
app.use('/api', apiRateLimiter);

// ---------------------------------------------------------------------------
// Health check — public, no auth required
// ---------------------------------------------------------------------------
app.get('/api/health', async (_req, res) => {
  let dbStatus: 'ok' | 'error' = 'error';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'ok';
  } catch {
    // DB unreachable — report degraded
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';
  const statusCode = dbStatus === 'ok' ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      app: 'ok',
      database: dbStatus,
    },
  });
});

// ---------------------------------------------------------------------------
// CSRF token endpoint — provides token for state-changing requests
// ---------------------------------------------------------------------------
app.get('/api/csrf-token', csrfProtection, csrfTokenProvider, (_req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/holidays', holidaysRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/customers', ledgerRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/inventory', inventoryRoutes);

// Duplicate under /api/v1 so client calls with v1 prefix work
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/subscriptions', subscriptionsRoutes);
app.use('/api/v1/holidays', holidaysRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/routes', routesRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/customers', ledgerRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/inventory', inventoryRoutes);

// ---------------------------------------------------------------------------
// Error handler — must be last
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server (only when this file is the entry point, not during tests)
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'test') {
  // Run pending database migrations before accepting requests (Req 15.7)
  if (process.env.NODE_ENV === 'production') {
    try {
      console.log('Running pending database migrations...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('Database migrations complete.');
    } catch (err) {
      console.error('Database migration failed:', err);
      process.exit(1);
    }
  } else {
    console.log('Skipping auto-migration in development (run "npx prisma migrate dev" manually).');
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Start BullMQ worker and register cron schedules
    startWorker();
    registerSchedules().catch((err) =>
      console.error('Failed to register job schedules:', err),
    );
  });
}

export default app;
