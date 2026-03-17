import { z } from 'zod';

// ---------------------------------------------------------------------------
// Known setting keys
// ---------------------------------------------------------------------------

export const SETTING_KEYS = {
  BILLING_CYCLE_START_DAY: 'billing_cycle_start_day',
  CUTOFF_TIME: 'cutoff_time',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
} as const;

// ---------------------------------------------------------------------------
// Value schemas for each setting key
// ---------------------------------------------------------------------------

export const billingCycleStartDaySchema = z.number().int().min(1).max(28);

/** HH:mm format (24-hour) */
export const cutoffTimeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format');

export const notificationPreferencesSchema = z.object({
  dailyGenerationFailure: z.object({
    dashboard: z.boolean(),
    email: z.boolean(),
  }),
  billingError: z.object({
    dashboard: z.boolean(),
    email: z.boolean(),
  }),
  accountLockout: z.object({
    dashboard: z.boolean(),
    email: z.boolean(),
  }),
});

// ---------------------------------------------------------------------------
// Update settings request body — partial, only include keys to update
// ---------------------------------------------------------------------------

export const updateSettingsSchema = z.object({
  billingCycleStartDay: billingCycleStartDaySchema.optional(),
  cutoffTime: cutoffTimeSchema.optional(),
  notificationPreferences: notificationPreferencesSchema.optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
