import { prisma } from '../../index.js';
import { SETTING_KEYS, type UpdateSettingsInput } from './settings.types.js';

// ---------------------------------------------------------------------------
// Default values for settings that haven't been persisted yet
// ---------------------------------------------------------------------------

const DEFAULTS: Record<string, unknown> = {
  [SETTING_KEYS.BILLING_CYCLE_START_DAY]: 1,
  [SETTING_KEYS.CUTOFF_TIME]: '18:00',
  [SETTING_KEYS.NOTIFICATION_PREFERENCES]: {
    dailyGenerationFailure: { dashboard: true, email: true },
    billingError: { dashboard: true, email: true },
    accountLockout: { dashboard: true, email: false },
  },
};

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

async function getRawSetting(key: string): Promise<unknown> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row ? row.value : DEFAULTS[key];
}

/**
 * Return all known system settings as a single object.
 */
export async function getSettings() {
  const rows = await prisma.systemSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    billingCycleStartDay: (map.get(SETTING_KEYS.BILLING_CYCLE_START_DAY) ?? DEFAULTS[SETTING_KEYS.BILLING_CYCLE_START_DAY]) as number,
    cutoffTime: (map.get(SETTING_KEYS.CUTOFF_TIME) ?? DEFAULTS[SETTING_KEYS.CUTOFF_TIME]) as string,
    notificationPreferences: (map.get(SETTING_KEYS.NOTIFICATION_PREFERENCES) ?? DEFAULTS[SETTING_KEYS.NOTIFICATION_PREFERENCES]),
  };
}

/**
 * Convenience accessor used by other modules (e.g. order generation cutoff).
 */
export async function getCutoffTime(): Promise<string> {
  return (await getRawSetting(SETTING_KEYS.CUTOFF_TIME)) as string;
}

export async function getBillingCycleStartDay(): Promise<number> {
  return (await getRawSetting(SETTING_KEYS.BILLING_CYCLE_START_DAY)) as number;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Upsert one or more settings. Only provided keys are updated.
 */
export async function updateSettings(input: UpdateSettingsInput, userId: string) {
  const ops: Promise<unknown>[] = [];

  if (input.billingCycleStartDay !== undefined) {
    ops.push(upsertSetting(SETTING_KEYS.BILLING_CYCLE_START_DAY, input.billingCycleStartDay, userId));
  }
  if (input.cutoffTime !== undefined) {
    ops.push(upsertSetting(SETTING_KEYS.CUTOFF_TIME, input.cutoffTime, userId));
  }
  if (input.notificationPreferences !== undefined) {
    ops.push(upsertSetting(SETTING_KEYS.NOTIFICATION_PREFERENCES, input.notificationPreferences, userId));
  }

  await Promise.all(ops);

  return getSettings();
}

async function upsertSetting(key: string, value: unknown, userId: string) {
  return prisma.systemSetting.upsert({
    where: { key },
    update: {
      value: value as any,
      updatedBy: userId,
    },
    create: {
      key,
      value: value as any,
      description: descriptionFor(key),
      updatedBy: userId,
    },
  });
}

function descriptionFor(key: string): string {
  switch (key) {
    case SETTING_KEYS.BILLING_CYCLE_START_DAY:
      return 'Day of month (1-28) when the billing cycle starts';
    case SETTING_KEYS.CUTOFF_TIME:
      return 'Daily cutoff time (HH:mm) after which subscription changes apply to the next delivery';
    case SETTING_KEYS.NOTIFICATION_PREFERENCES:
      return 'Per-event-type notification channel preferences';
    default:
      return '';
  }
}
