import type { Job } from 'bullmq';
import { prisma } from '../index.js';
import { generateInvoicesForCycle } from '../modules/billing/billing.service.js';
import { dispatchNotification } from '../lib/notificationProvider.js';

export interface MonthlyInvoiceGenerationData {
  cycleStart: string; // ISO date string YYYY-MM-DD
  cycleEnd: string;   // ISO date string YYYY-MM-DD
  triggeredBy: 'scheduler' | 'manual';
  userId?: string;
}

/**
 * Calculate the previous month's billing cycle dates.
 * E.g. if today is 2024-02-01, returns { start: '2024-01-01', end: '2024-01-31' }.
 */
function getPreviousMonthCycle(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed, so this is already "previous" month index + 1

  // First day of previous month
  const startDate = new Date(Date.UTC(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, 1));
  // Last day of previous month (day 0 of current month)
  const endDate = new Date(Date.UTC(year, month, 0));

  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };
}

/**
 * BullMQ processor for monthly invoice generation.
 *
 * - Acquires a concurrency lock via the job_executions table (only one
 *   "running" row per job name at a time).
 * - Logs start/end/status/records to job_executions.
 * - On failure, creates a notification for every active Super_Admin user.
 */
export default async function processMonthlyInvoiceGeneration(
  job: Job<MonthlyInvoiceGenerationData>,
): Promise<void> {
  const { triggeredBy, userId } = job.data;
  let { cycleStart, cycleEnd } = job.data;

  // For scheduler-triggered jobs where cycleStart/cycleEnd are empty,
  // calculate the previous month's cycle
  if (!cycleStart || !cycleEnd) {
    const prev = getPreviousMonthCycle();
    cycleStart = prev.start;
    cycleEnd = prev.end;
  }

  const jobName = 'monthly_invoice_generation';

  // ── Concurrency lock: check for an already-running execution ──────────
  const running = await prisma.jobExecution.findFirst({
    where: { jobName, status: 'running' },
  });
  if (running) {
    throw new Error(
      `Monthly invoice generation is already running (execution ${running.id}, started ${running.startedAt.toISOString()})`,
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
    const summary = await generateInvoicesForCycle(cycleStart, cycleEnd);

    // ── Mark success ────────────────────────────────────────────────────
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        completedAt: new Date(),
        status: 'success',
        recordsProcessed: summary.invoicesCreated,
      },
    });
  } catch (err: any) {
    // ── Mark failure ────────────────────────────────────────────────────
    const errorMessage =
      err instanceof Error ? err.message : String(err);

    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        completedAt: new Date(),
        status: 'failure',
        errorMessage,
      },
    });

    // ── Notify all active Super_Admin users ─────────────────────────────
    const superAdmins = await prisma.user.findMany({
      where: { role: 'super_admin', isActive: true },
      select: { id: true, email: true },
    });

    if (superAdmins.length > 0) {
      await dispatchNotification({
        title: 'Monthly invoice generation failed',
        body: `Invoice generation for cycle ${cycleStart} to ${cycleEnd} failed: ${errorMessage}`,
        eventType: 'billing_error',
        recipientUserIds: superAdmins.map((u) => u.id),
        emailRecipients: superAdmins.map((u) => u.email),
      });
    }

    throw err; // re-throw so BullMQ marks the job as failed
  }
}
