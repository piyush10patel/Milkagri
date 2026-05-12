import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 border-b border-neutral-200', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 -mb-px',
            active === tab.id
              ? 'border-primary-500 text-primary-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300',
          )}
        >
          {tab.icon && <span className="h-4 w-4">{tab.icon}</span>}
          {tab.label}
          {tab.badge !== undefined && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              active === tab.id
                ? 'bg-primary-100 text-primary-700'
                : 'bg-neutral-100 text-neutral-600',
            )}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
