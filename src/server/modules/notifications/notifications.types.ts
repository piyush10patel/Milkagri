import { z } from 'zod';

export const notificationQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  isRead: z.enum(['true', 'false']).optional(),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

export const markReadParamsSchema = z.object({
  id: z.string().uuid(),
});

/** Valid event types for notification configuration */
const validEventTypes = ['daily_generation_failure', 'billing_error', 'account_lockout'] as const;
const validChannels = ['dashboard', 'email', 'sms', 'webhook'] as const;

export const notificationPreferencesSchema = z.record(
  z.enum(validEventTypes),
  z.array(z.enum(validChannels)),
);

/** Event types that can trigger notifications */
export type NotificationEventType =
  | 'daily_generation_failure'
  | 'billing_error'
  | 'account_lockout';

/** Channels through which notifications can be delivered */
export type NotificationChannel = 'dashboard' | 'email' | 'sms' | 'webhook';

export interface NotificationPayload {
  title: string;
  body: string;
  eventType: NotificationEventType;
  /** User IDs to receive dashboard notifications */
  recipientUserIds: string[];
  /** Email addresses for email notifications (optional) */
  emailRecipients?: string[];
}
