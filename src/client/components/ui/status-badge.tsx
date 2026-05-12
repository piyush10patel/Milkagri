import { Badge } from './badge';

const statusMap: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; label: string }> = {
  // Generic
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'neutral', label: 'Inactive' },
  pending: { variant: 'warning', label: 'Pending' },

  // Delivery orders
  delivered: { variant: 'success', label: 'Delivered' },
  skipped: { variant: 'warning', label: 'Skipped' },
  failed: { variant: 'danger', label: 'Failed' },
  returned: { variant: 'danger', label: 'Returned' },

  // Payments
  paid: { variant: 'success', label: 'Paid' },
  unpaid: { variant: 'danger', label: 'Unpaid' },
  partial: { variant: 'warning', label: 'Partial' },

  // Subscriptions
  paused: { variant: 'warning', label: 'Paused' },
  cancelled: { variant: 'neutral', label: 'Cancelled' },

  // Customers
  stopped: { variant: 'danger', label: 'Stopped' },

  // Milk sessions
  morning: { variant: 'info', label: 'Morning' },
  evening: { variant: 'warning', label: 'Evening' },
};

interface StatusBadgeProps {
  status: string;
  dot?: boolean;
}

export function StatusBadge({ status, dot = true }: StatusBadgeProps) {
  const mapped = statusMap[status.toLowerCase()] ?? { variant: 'neutral' as const, label: status };
  return (
    <Badge variant={mapped.variant} dot={dot}>
      {mapped.label}
    </Badge>
  );
}
