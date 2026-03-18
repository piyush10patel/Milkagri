import type { Job } from 'bullmq';
import { prisma } from '../index.js';
import { runDailyBillingJob, generateInvoiceForCustomer } from '../modules/billing/billing.service.js';
import { dispatchNotification } from '../lib/notificationProvider.js';

export interface DailyInvoiceGenerationData {
  triggeredBy: 'scheduler' | 'manual';
  userId?: string;
  /** Optional explicit cycle dates for manual triggers (ISO YYYY-MM-DD). */
  cycleStart?: string;
  cycleEnd?: string;
  /** Optional customer ID for manual single-customer invoice generation. */
  customerId?: string;
}

/**
 * BullMQ processor for daily invoice generation.
 *
 * - Acquires a concurrency lock via the job_executions table (only one
 *   "running" row per job name at a time).
 * - Logs start/end/status/records to job_executions.
 * - On failure, creates a notification for every active Super_Admin user.
 *
 * When triggered manually with explicit cycleStart/cycleEnd (and optionally
 * customerId), it generates an invoice for that specific cycle instead of
 * running the full daily billing sweep.
 */
export default async function processDailyInvoiceGeneration(
  job: Job<DailyInvoiceGenerationData>,
): Promise<void> {
  const { triggeredBy, userId, cycleStart, cycleEnd, customerId } = job.data;
  const jobName = 'daily_invoice_generation';

  // ── Concurrency lock: check for an already-running execution ──────────
  const running = await prisma.jobExecution.findFirst({
    where: { jobName, status: 'running' },
  });
  if (running) {
    throw new Error(
      `Daily invoice generation is already running (execution ${running.id}, started ${running.startedAt.toISOString()})`,
    );
  }

  // ── Create job execution record ───────────────────────────────────────
  const execution = await prisma.jobExecution.create({
    data: {
      jobName,
      startedAt: new Date(),
      status: 'running',
      triggeredBy,
      userId: userId ?? null,
    },
  });

  try {
    let recordsProcessed = 0;
    let errorMessage: string | null = null;

    if (cycleStart && cycleEnd) {
      // Manual trigger with explicit cycle dates
      const start = new Date(cycleStart + 'T00:00:00.000Z');
      const end = new Date(cycleEnd + 'T00:00:00.000Z');

      if (customerId) {
        await generateInvoiceForCustomer(customerId, start, end);
        recordsProcessed = 1;
      } else {
        // Run the full billing job but use today = end + 1 day so all cycles
        // ending on or before `end` are picked up
        const dayAfterEnd = new Date(end);
        dayAfterEnd.setUTCDate(dayAfterEnd.getUTCDate() + 1);
        const summary = await runDailyBillingJob(dayAfterEnd);
        recordsProcessed = summary.invoicesCreated;
        if (summary.errors.length > 0) {
          errorMessage = `${summary.errors.length} customer(s) failed: ${summary.errors.map((e) => e.customerId).join(', ')}`;
        }
      }
    } else {
      // Scheduled run — process all customers whose cycle has ended
      const summary = await runDailyBillingJob();
      recordsProcessed = summary.invoicesCreated;
      if (summary.errors.length > 0) {
        errorMessage = `${summary.errors.length} customer(s) failed: ${summary.errors.map((e) => e.customerId).join(', ')}`;
      }
    }

    // ── Mark success ────────────────────────────────────────────────────
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        completedAt: new Date(),
        status: 'success',
        recordsProcessed,
        errorMessage,
      },
    });
  } catch (err: any) {
    // ── Mark failure ────────────────────────────────────────────────────
    const errMsg = err instanceof Error ? err.message : String(err);

    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        completedAt: new Date(),
        status: 'failure',
        errorMessage: errMsg,
      },
    });

    // ── Notify all active Super_Admin users ─────────────────────────────
    const superAdmins = await prisma.user.findMany({
      where: { role: 'super_admin', isActive: true },
      select: { id: true, email: true },
    });

    if (superAdmins.length > 0) {
      await dispatchNotification({
        title: 'Daily invoice generation failed',
        body: `Invoice generation failed: ${errMsg}`,
        eventType: 'billing_error',
        recipientUserIds: superAdmins.map((u) => u.id),
        emailRecipients: superAdmins.map((u) => u.email),
      });
    }

    throw err; // re-throw so BullMQ marks the job as failed
  }
}
