import { Queue, Worker } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import processDailyOrderGeneration from './dailyOrderGeneration.js';
import type { DailyOrderGenerationData } from './dailyOrderGeneration.js';
import processDailyInvoiceGeneration from './dailyInvoiceGeneration.js';
import type { DailyInvoiceGenerationData } from './dailyInvoiceGeneration.js';

// ── Shared connection options (parsed from env to avoid circular import) ─
function parseRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const connection: ConnectionOptions = parseRedisConnection();

// ── Queue names ─────────────────────────────────────────────────────────
const DAILY_ORDER_QUEUE = 'daily-order-generation';
const DAILY_INVOICE_QUEUE = 'daily-invoice-generation';

// ── Queues ──────────────────────────────────────────────────────────────
export const dailyOrderQueue = new Queue<DailyOrderGenerationData>(
  DAILY_ORDER_QUEUE,
  { connection },
);

export const dailyInvoiceQueue = new Queue<DailyInvoiceGenerationData>(
  DAILY_INVOICE_QUEUE,
  { connection },
);

// ── Worker ──────────────────────────────────────────────────────────────
let worker: Worker<DailyOrderGenerationData> | null = null;
let dailyInvoiceWorker: Worker<DailyInvoiceGenerationData> | null = null;

/**
 * Start the BullMQ worker that processes daily order generation jobs.
 * Call once at app startup (or in a dedicated worker process).
 */
export function startWorker(): Worker<DailyOrderGenerationData> {
  if (worker) return worker;

  worker = new Worker<DailyOrderGenerationData>(
    DAILY_ORDER_QUEUE,
    processDailyOrderGeneration,
    {
      connection,
      concurrency: 1, // only one job at a time
    },
  );

  worker.on('completed', (job) => {
    console.log(`[jobs] daily-order-generation completed: ${job?.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[jobs] daily-order-generation failed: ${job?.id}`,
      err.message,
    );
  });

  // Also start the daily invoice worker
  startDailyInvoiceWorker();

  return worker;
}

/**
 * Start the BullMQ worker that processes daily invoice generation jobs.
 */
export function startDailyInvoiceWorker(): Worker<DailyInvoiceGenerationData> {
  if (dailyInvoiceWorker) return dailyInvoiceWorker;

  dailyInvoiceWorker = new Worker<DailyInvoiceGenerationData>(
    DAILY_INVOICE_QUEUE,
    processDailyInvoiceGeneration,
    {
      connection,
      concurrency: 1,
    },
  );

  dailyInvoiceWorker.on('completed', (job) => {
    console.log(`[jobs] daily-invoice-generation completed: ${job?.id}`);
  });

  dailyInvoiceWorker.on('failed', (job, err) => {
    console.error(
      `[jobs] daily-invoice-generation failed: ${job?.id}`,
      err.message,
    );
  });

  return dailyInvoiceWorker;
}

/**
 * Register the repeatable cron schedule for daily order generation.
 * Default: every day at 02:00 AM (configurable via DAILY_ORDER_CRON env).
 *
 * Also registers the daily invoice generation cron.
 * Default: 3 AM every day (configurable via DAILY_INVOICE_CRON env).
 */
export async function registerSchedules(): Promise<void> {
  // ── Daily order generation schedule ───────────────────────────────────
  const dailyCron = process.env.DAILY_ORDER_CRON || '0 2 * * *';

  // Remove any stale repeatable jobs first, then add the current schedule
  const existingDaily = await dailyOrderQueue.getRepeatableJobs();
  for (const job of existingDaily) {
    await dailyOrderQueue.removeRepeatableByKey(job.key);
  }

  // Tomorrow's date as default target (the processor receives it via job data)
  await dailyOrderQueue.add(
    'scheduled',
    {
      // The cron fires at 2 AM; generate orders for "today" (the day the job runs)
      targetDate: '', // will be resolved at processing time if empty
      triggeredBy: 'scheduler',
    },
    {
      repeat: { pattern: dailyCron },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  );

  console.log(`[jobs] Daily order generation cron registered: ${dailyCron}`);

  // ── Daily invoice generation schedule ───────────────────────────────
  const dailyInvoiceCron = process.env.DAILY_INVOICE_CRON || '0 3 * * *';

  const existingInvoice = await dailyInvoiceQueue.getRepeatableJobs();
  for (const job of existingInvoice) {
    await dailyInvoiceQueue.removeRepeatableByKey(job.key);
  }

  await dailyInvoiceQueue.add(
    'scheduled',
    {
      triggeredBy: 'scheduler',
    },
    {
      repeat: { pattern: dailyInvoiceCron },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  );

  console.log(`[jobs] Daily invoice generation cron registered: ${dailyInvoiceCron}`);
}

/**
 * Enqueue a manual (one-off) daily order generation run.
 */
export async function triggerManualGeneration(
  targetDate: string,
  userId: string,
): Promise<string> {
  const job = await dailyOrderQueue.add('manual', {
    targetDate,
    triggeredBy: 'manual',
    userId,
  });
  return job.id ?? '';
}

/**
 * Enqueue a manual (one-off) daily invoice generation run.
 */
export async function triggerManualInvoiceGeneration(
  cycleStart: string,
  cycleEnd: string,
  userId: string,
  customerId?: string,
): Promise<string> {
  const job = await dailyInvoiceQueue.add('manual', {
    triggeredBy: 'manual',
    userId,
    cycleStart,
    cycleEnd,
    customerId,
  });
  return job.id ?? '';
}

/**
 * Gracefully shut down all workers.
 */
export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (dailyInvoiceWorker) {
    await dailyInvoiceWorker.close();
    dailyInvoiceWorker = null;
  }
}
