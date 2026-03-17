import type { Job } from 'bullmq';
import { prisma } from '../index.js';
import { generateOrdersForDate } from '../modules/orders/orders.service.js';
import { dispatchNotification } from '../lib/notificationProvider.js';

export interface DailyOrderGenerationData {
  targetDate: string; // ISO date string YYYY-MM-DD
  triggeredBy: 'scheduler' | 'manual';
  userId?: string;
}

/**
 * BullMQ processor for daily order generation.
 *
 * - Acquires a concurrency lock via the job_executions table (only one
 *   "running" row per job name + target date at a time).
 * - Logs start/end/status/records to job_executions.
 * - On failure, creates a notification for every active Super_Admin user.
 */
export default async function processDailyOrderGeneration(
  job: Job<DailyOrderGenerationData>,
): Promise<void> {
  const { targetDate, triggeredBy, userId } = job.data;
  // For cron-scheduled jobs the targetDate may be empty — default to today
  const date = targetDate ? new Date(targetDate) : new Date(new Date().toISOString().slice(0, 10));
  const jobName = 'daily_order_generation';

  // ── Concurrency lock: check for an already-running execution ──────────
  const running = await prisma.jobExecution.findFirst({
    where: { jobName, status: 'running' },
  });
  if (running) {
    throw new Error(
      `Daily order generation is already running (execution ${running.id}, started ${running.startedAt.toISOString()})`,
    );
  }

  // ── Create job execution record ───────────────────────────────────────
  const execution = await prisma.jobExecution.create({
    data: {
      jobName,
      startedAt: new Date(),
      status: 'running',
      triggeredBy: triggeredBy,
      userId: userId ?? null,
    },
  });

  try {
    const summary = await generateOrdersForDate(date);

    // ── Mark success ────────────────────────────────────────────────────
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        completedAt: new Date(),
        status: 'success',
        recordsProcessed: summary.totalCreated,
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
        title: 'Daily order generation failed',
        body: `Order generation for ${date.toISOString().slice(0, 10)} failed: ${errorMessage}`,
        eventType: 'daily_generation_failure',
        recipientUserIds: superAdmins.map((u) => u.id),
        emailRecipients: superAdmins.map((u) => u.email),
      });
    }

    throw err; // re-throw so BullMQ marks the job as failed
  }
}
