import { prisma } from '../../index.js';
import type { Prisma } from '@prisma/client';
import type { PaginationParams } from '../../lib/pagination.js';
import type { NotificationQuery } from './notifications.types.js';
import { dispatchNotification } from '../../lib/notificationProvider.js';
import type { PushSubscriptionInput } from './notifications.types.js';

function prismaAny() {
  return prisma as any;
}

/**
 * Query notifications for a specific user with filtering and pagination.
 * Returns in reverse chronological order.
 */
export async function listNotifications(
  userId: string,
  query: NotificationQuery,
  pagination: PaginationParams,
) {
  const where: Prisma.NotificationWhereInput = { userId };

  if (query.isRead !== undefined) {
    where.isRead = query.isRead === 'true';
  }

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  return { items, total };
}

/**
 * Mark a single notification as read. Only the owning user can mark it.
 */
export async function markAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

/**
 * Create dashboard notifications for specified users.
 */
export async function createNotifications(
  userIds: string[],
  title: string,
  body: string,
  eventType: string,
) {
  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title,
      body,
      eventType,
    })),
  });
}

/**
 * Send notifications for a system event through all configured channels.
 * This is the main entry point for other modules to trigger notifications.
 */
export async function notifySystemEvent(input: {
  title: string;
  body: string;
  eventType: string;
  recipientUserIds: string[];
  emailRecipients?: string[];
}) {
  await dispatchNotification(input);
}

/**
 * Helper: get all active Super_Admin and Admin user IDs for notification targeting.
 */
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['super_admin', 'admin'] },
      isActive: true,
    },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

/**
 * Helper: get all active Super_Admin user IDs.
 */
export async function getSuperAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'super_admin', isActive: true },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

/**
 * Helper: get email addresses for admin users.
 */
export async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['super_admin', 'admin'] },
      isActive: true,
      email: { not: undefined },
    },
    select: { email: true },
  });
  return admins.map((u) => u.email);
}


/**
 * Get notification preferences from system_settings.
 * Returns a map of event type → enabled channels.
 */
export async function getNotificationPreferences(): Promise<Record<string, string[]>> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'notification_preferences' },
  });

  if (setting && setting.value) {
    return setting.value as Record<string, string[]>;
  }

  // Default preferences: all events → dashboard only
  return {
    daily_generation_failure: ['dashboard', 'push'],
    billing_error: ['dashboard', 'push'],
    account_lockout: ['dashboard', 'push'],
  };
}

/**
 * Update notification preferences in system_settings.
 */
export async function updateNotificationPreferences(
  preferences: Record<string, string[]>,
  userId: string,
): Promise<Record<string, string[]>> {
  await prisma.systemSetting.upsert({
    where: { key: 'notification_preferences' },
    update: {
      value: preferences as any,
      updatedBy: userId,
    },
    create: {
      key: 'notification_preferences',
      value: preferences as any,
      description: 'Notification channel preferences per event type',
      updatedBy: userId,
    },
  });

  return preferences;
}

export function getWebPushPublicKey(): string | null {
  const key = process.env.VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

export async function upsertPushSubscription(
  userId: string,
  input: PushSubscriptionInput,
  userAgent?: string,
) {
  const expirationTime =
    input.expirationTime === null || input.expirationTime === undefined
      ? null
      : new Date(input.expirationTime);

  return prismaAny().pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      userId,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      expirationTime,
      userAgent: userAgent ?? null,
    },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      expirationTime,
      userAgent: userAgent ?? null,
    },
  });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await prismaAny().pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}
