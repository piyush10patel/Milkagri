import ReportPage from './ReportPage';

const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleString() : '—');

const weekdayLabel: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

const keyLabel: Record<string, string> = {
  quantity: 'Qty',
  deliverySession: 'Shift',
  frequencyType: 'Frequency',
  weekdays: 'Weekdays',
  startDate: 'Start',
  endDate: 'End',
  resumedAt: 'Resumed',
  status: 'Status',
  packBreakdown: 'Pack',
};

function formatScalar(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatWeekdays(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return '—';
  const labels = value.map((day) => weekdayLabel[Number(day)] ?? String(day));
  return labels.join(', ');
}

function formatPack(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return '—';
  const parts = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const packSize = row.packSize;
      const packCount = row.packCount;
      if (packSize == null || packCount == null) return null;
      return `${packCount} x ${packSize}`;
    })
    .filter(Boolean) as string[];
  return parts.length ? parts.join(' + ') : '—';
}

function formatKnownValue(key: string, value: unknown): string {
  if (key === 'weekdays') return formatWeekdays(value);
  if (key === 'packBreakdown') return formatPack(value);
  if (key === 'deliverySession' || key === 'frequencyType' || key === 'status') {
    return value == null || value === '' ? '—' : titleCase(String(value));
  }
  if (key === 'startDate' || key === 'endDate' || key === 'resumedAt') {
    return value ? new Date(String(value)).toLocaleDateString() : '—';
  }
  return formatScalar(value);
}

function formatChangeValue(v: unknown): string {
  if (v == null || v === '') return '—';
  const raw = String(v);

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const relevantKeys = Object.keys(parsed).filter((key) => key in keyLabel);

    if (!relevantKeys.length) {
      // If payload only has technical fields (ex: routeId UUID), keep the report clean.
      return '—';
    }

    const cleaned = relevantKeys
      .map((key) => ({ label: keyLabel[key], value: formatKnownValue(key, parsed[key]) }))
      .filter((item) => item.value !== '—')
      .map((item) => `${item.label} ${item.value}`)
      .join(' | ');

    return cleaned || '—';
  } catch {
    return raw;
  }
}

const COLUMNS = [
  { key: 'createdAt', label: 'Date', format: formatDate },
  { key: 'customer.name', label: 'Customer' },
  { key: 'productName', label: 'Product' },
  { key: 'changeType', label: 'Change Type' },
  { key: 'oldValue', label: 'Old Value', format: formatChangeValue },
  { key: 'newValue', label: 'New Value', format: formatChangeValue },
  { key: 'changedBy.name', label: 'Changed By' },
];

export default function SubscriptionChangesReportPage() {
  return <ReportPage title="Subscription Changes Report" endpoint="subscription-changes" columns={COLUMNS} />;
}
