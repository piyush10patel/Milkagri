import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import webpush from 'web-push';
import { prisma } from '../index.js';

function prismaAny() {
  return prisma as any;
}

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface NotificationProvider {
  send(recipient: string, subject: string, body: string): Promise<void>;
}

// ─── Dashboard Provider ──────────────────────────────────────────────────────

/**
 * Writes notifications to the notifications table for in-app display.
 * The `recipient` is the user ID (UUID).
 */
export class DashboardNotificationProvider implements NotificationProvider {
  constructor(private eventType: string) {}

  async send(recipientUserId: string, title: string, body: string): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: recipientUserId,
        title,
        body,
        eventType: this.eventType,
      },
    });
  }
}

// ─── Email Provider ──────────────────────────────────────────────────────────

/**
 * Sends email notifications via SMTP using Nodemailer.
 * Configured through environment variables.
 */
export class EmailNotificationProvider implements NotificationProvider {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host) return null; // SMTP not configured

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    return this.transporter;
  }

  async send(recipientEmail: string, subject: string, body: string): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) return; // silently skip if SMTP not configured

    const from = process.env.SMTP_FROM || 'noreply@example.com';

    await transporter.sendMail({
      from,
      to: recipientEmail,
      subject,
      text: body,
    });
  }
}

// ─── SMS Provider (Stub) ─────────────────────────────────────────────────────

/**
 * Stub SMS notification provider. Logs the send attempt for future integration.
 * Configure via SMS_PROVIDER_URL and SMS_API_KEY environment variables.
 */
export class SmsNotificationProvider implements NotificationProvider {
  private providerUrl: string | undefined;
  private apiKey: string | undefined;

  constructor() {
    this.providerUrl = process.env.SMS_PROVIDER_URL;
    this.apiKey = process.env.SMS_API_KEY;
  }

  async send(recipientPhone: string, subject: string, body: string): Promise<void> {
    if (!this.providerUrl || !this.apiKey) {
      // SMS not configured — silently skip
      return;
    }

    // Stub: log the SMS send attempt for future integration
    console.log(
      `[SMS] Would send to ${recipientPhone}: ${subject} — ${body.slice(0, 100)}`,
    );
  }
}

// ─── Webhook Provider ────────────────────────────────────────────────────────

/**
 * Sends notification payloads to a configured webhook URL via HTTP POST.
 * Configure via WEBHOOK_NOTIFICATION_URL environment variable.
 */
export class WebhookNotificationProvider implements NotificationProvider {
  private webhookUrl: string | undefined;

  constructor(private eventType: string, webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.WEBHOOK_NOTIFICATION_URL;
  }

  async send(recipient: string, subject: string, body: string): Promise<void> {
    if (!this.webhookUrl) {
      // Webhook not configured — silently skip
      return;
    }

    const payload = {
      recipient,
      subject,
      body,
      eventType: this.eventType,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(
          `[Webhook] Failed to deliver notification: HTTP ${response.status}`,
        );
      }
    } catch (error) {
      console.error('[Webhook] Error delivering notification:', error);
    }
  }
}

// ─── Notification Dispatcher ─────────────────────────────────────────────────

export interface DispatchNotificationInput {
  title: string;
  body: string;
  eventType: string;
  /** User IDs for dashboard notifications */
  recipientUserIds: string[];
  /** Email addresses for email channel (optional) */
  emailRecipients?: string[];
  /** Phone numbers for SMS channel (optional) */
  smsRecipients?: string[];
  /** Override webhook URL for this dispatch (optional, falls back to env var) */
  webhookUrl?: string;
}

let vapidConfigured = false;
function configureWebPush() {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@example.com';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * Dispatches notifications through configured channels.
 * Checks system_settings for notification preferences per event type.
 * Falls back to dashboard-only if no preferences are configured.
 */
export async function dispatchNotification(input: DispatchNotificationInput): Promise<void> {
  const { title, body, eventType, recipientUserIds, emailRecipients, smsRecipients, webhookUrl } = input;

  // Load notification preferences from system_settings
  const channels = await getEnabledChannels(eventType);

  // Dashboard notifications
  if (channels.includes('dashboard') && recipientUserIds.length > 0) {
    const provider = new DashboardNotificationProvider(eventType);
    await Promise.all(
      recipientUserIds.map((userId) => provider.send(userId, title, body)),
    );
  }

  // Email notifications
  if (channels.includes('email') && emailRecipients && emailRecipients.length > 0) {
    const provider = new EmailNotificationProvider();
    await Promise.all(
      emailRecipients.map((email) => provider.send(email, title, body)),
    );
  }

  // SMS notifications
  if (channels.includes('sms') && smsRecipients && smsRecipients.length > 0) {
    const provider = new SmsNotificationProvider();
    await Promise.all(
      smsRecipients.map((phone) => provider.send(phone, title, body)),
    );
  }

  // Webhook notifications
  if (channels.includes('webhook')) {
    const provider = new WebhookNotificationProvider(eventType, webhookUrl);
    await provider.send(recipientUserIds[0] ?? '', title, body);
  }

  // Web push notifications
  if (channels.includes('push') && recipientUserIds.length > 0 && configureWebPush()) {
    const subscriptions = await prismaAny().pushSubscription.findMany({
      where: { userId: { in: recipientUserIds } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    const payload = JSON.stringify({
      title,
      body,
      eventType,
      timestamp: new Date().toISOString(),
    });

    await Promise.all(
      subscriptions.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (error: any) {
          const statusCode = error?.statusCode as number | undefined;
          if (statusCode === 404 || statusCode === 410) {
            await prismaAny().pushSubscription.delete({ where: { id: sub.id } });
          }
        }
      }),
    );
  }
}

/**
 * Reads notification_preferences from system_settings to determine
 * which channels are enabled for a given event type.
 * Defaults to ['dashboard'] if no preferences are configured.
 */
async function getEnabledChannels(eventType: string): Promise<string[]> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'notification_preferences' },
    });

    if (setting && setting.value) {
      const prefs = setting.value as Record<string, string[]>;
      if (prefs[eventType] && Array.isArray(prefs[eventType])) {
        return prefs[eventType];
      }
    }
  } catch {
    // If settings table doesn't exist or query fails, fall back to default
  }

  return ['dashboard'];
}
