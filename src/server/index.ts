import 'dotenv/config';
import { execSync } from 'node:child_process';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import session, { type SessionOptions } from 'express-session';
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
import pricingCategoriesRoutes from './modules/pricing-categories/pricing-categories.routes.js';
import milkCollectionsRoutes from './modules/milk-collections/milk-collections.routes.js';
import handoverRoutes from './modules/handover/handover.routes.js';
import agentAssignmentsRoutes from './modules/agent-assignments/agent-assignments.routes.js';
import agentCollectionsRoutes from './modules/agent-collections/agent-collections.routes.js';
import agentRemittancesRoutes from './modules/agent-remittances/agent-remittances.routes.js';
import permissionsRoutes from './modules/permissions/permissions.routes.js';
import {
  bootstrapSuperAdmin,
  hasBootstrapAdminEnv,
  shouldAutoBootstrapAdmin,
} from './lib/bootstrapAdmin.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../client');
const isProduction = process.env.NODE_ENV === 'production';

function requireProductionEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable in production: ${name}`);
  }
  return value;
}

function resolveCorsOrigin() {
  const configured = process.env.CORS_ORIGIN
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured.length === 1 ? configured[0] : configured;
  }

  return isProduction ? false : true;
}

function createRedisClient(url: string) {
  try {
    const parsed = new URL(url);
    const isTls = parsed.protocol === 'rediss:';
    return new Redis({
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port, 10) || 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      ...(isTls ? { tls: {} } : {}),
    });
  } catch {
    return new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
}

function shouldUseRedisSessions(): boolean {
  return process.env.DISABLE_REDIS_SESSIONS !== 'true';
}

// ---------------------------------------------------------------------------
// Database client
// ---------------------------------------------------------------------------
export const prisma = new PrismaClient();

if (isProduction) {
  requireProductionEnv('DATABASE_URL');
  requireProductionEnv('SESSION_SECRET');
  if (shouldUseRedisSessions()) {
    requireProductionEnv('REDIS_URL');
  }
}

// ---------------------------------------------------------------------------
// Redis client (used for sessions; also available for BullMQ elsewhere)
// ---------------------------------------------------------------------------
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = shouldUseRedisSessions() ? createRedisClient(redisUrl) : null;
redis?.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

// ---------------------------------------------------------------------------
// 1. Security headers
// ---------------------------------------------------------------------------
app.use(
  helmet({
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://unpkg.com'],
        connectSrc: [
          "'self'",
          'https://router.project-osrm.org',
          'https://*.tile.openstreetmap.org',
          'https://unpkg.com',
        ],
        fontSrc: ["'self'", 'data:', 'https://unpkg.com'],
      },
    },
  }),
);

// ---------------------------------------------------------------------------
// 2. CORS
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: resolveCorsOrigin(),
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// 3. Body parsing
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Render and similar platforms terminate TLS at the proxy. Trust the first
// proxy hop so secure cookies work correctly in production.
if (isProduction) {
  app.set('trust proxy', 1);
}

// ---------------------------------------------------------------------------
// 4. Session management (Redis store)
// ---------------------------------------------------------------------------
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-me';
const rawSameSite = (process.env.SESSION_COOKIE_SAMESITE || 'lax').toLowerCase();
let cookieSameSite: 'lax' | 'strict' | 'none' =
  rawSameSite === 'strict' || rawSameSite === 'none' ? rawSameSite : 'lax';
const cookieSecure =
  process.env.SESSION_COOKIE_SECURE === 'true'
    ? true
    : process.env.SESSION_COOKIE_SECURE === 'false'
      ? false
      : process.env.NODE_ENV === 'production';
if (cookieSameSite === 'none' && !cookieSecure) {
  console.warn(
    'SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true. Falling back to sameSite=lax.',
  );
  cookieSameSite = 'lax';
}
const sessionConfig: SessionOptions = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'milk.sid',
  cookie: {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
};

if (redis) {
  sessionConfig.store = new RedisStore({ client: redis });
} else {
  console.warn('Redis sessions disabled; using in-memory session store.');
}

app.use(
  session(sessionConfig),
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
app.use('/api/delivery', deliveryRoutes);
app.use('/api/delivery/routes', routesRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/customers', ledgerRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/pricing-categories', pricingCategoriesRoutes);
app.use('/api/milk-collections', milkCollectionsRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/agent-assignments', agentAssignmentsRoutes);
app.use('/api/agent-collections', agentCollectionsRoutes);
app.use('/api/agent-remittances', agentRemittancesRoutes);
app.use('/api/permissions', permissionsRoutes);

// Duplicate under /api/v1 so client calls with v1 prefix work
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/subscriptions', subscriptionsRoutes);
app.use('/api/v1/holidays', holidaysRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1/delivery/routes', routesRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/customers', ledgerRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/pricing-categories', pricingCategoriesRoutes);
app.use('/api/v1/milk-collections', milkCollectionsRoutes);
app.use('/api/v1/handover', handoverRoutes);
app.use('/api/v1/agent-assignments', agentAssignmentsRoutes);
app.use('/api/v1/agent-collections', agentCollectionsRoutes);
app.use('/api/v1/agent-remittances', agentRemittancesRoutes);
app.use('/api/v1/permissions', permissionsRoutes);

// ---------------------------------------------------------------------------
// Serve built frontend in production
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDistPath));

  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

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

    if (process.env.ENABLE_BACKGROUND_JOBS !== 'false') {
      import('./jobs/index.js')
        .then(({ startWorker, registerSchedules }) => {
          startWorker();
          registerSchedules().catch((err) =>
            console.error('Failed to register job schedules:', err),
          );
        })
        .catch((err) => {
          console.error('Failed to load background jobs module:', err);
        });
    }
  });

  if (isProduction && shouldAutoBootstrapAdmin()) {
    if (!hasBootstrapAdminEnv()) {
      console.warn('AUTO_BOOTSTRAP_ADMIN is enabled, but ADMIN_EMAIL or ADMIN_PASSWORD is missing.');
    } else {
      bootstrapSuperAdmin(prisma)
        .then((email) => console.log(`Production admin bootstrap complete for ${email}`))
        .catch((err) => console.error('Production admin bootstrap failed:', err));
    }
  }
}

export default app;
