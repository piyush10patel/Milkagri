import { cn } from '@/lib/cn';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from './skeleton';

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; positive?: boolean };
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export function KpiCard({ label, value, trend, icon, loading, className }: KpiCardProps) {
  if (loading) {
    return (
      <div className={cn('rounded-xl border border-neutral-200 bg-white p-5 space-y-3', className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-neutral-200 bg-white p-5 shadow-card', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-neutral-500">{label}</span>
        {icon && (
          <div className="rounded-lg bg-primary-50 p-2 text-primary-600">
            {icon}
          </div>
        )}
      </div>
      <div className="text-2xl font-semibold text-neutral-900 tracking-tight">{value}</div>
      {trend && (
        <div className="flex items-center gap-1 mt-1.5">
          {trend.positive !== undefined ? (
            trend.positive ? (
              <TrendingUp className="h-3.5 w-3.5 text-success-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-danger-500" />
            )
          ) : null}
          <span className={cn(
            'text-xs font-medium',
            trend.positive === undefined ? 'text-neutral-500' :
            trend.positive ? 'text-success-600' : 'text-danger-600',
          )}>
            {trend.value > 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs text-neutral-400">vs last period</span>
        </div>
      )}
    </div>
  );
}
