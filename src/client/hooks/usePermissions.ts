import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from './useAuth';

const ALL_PERMISSIONS = new Set([
  'customers', 'products', 'pricing', 'subscriptions', 'orders',
  'milk_summary', 'milk_collection', 'deliveries', 'routes',
  'route_map', 'live_gps', 'billing', 'payments', 'reports',
  'users', 'notifications', 'audit_logs', 'settings',
  'collections_overview', 'agent_assignments', 'remittances',
  'agent_balances', 'agent_collections_dashboard',
]);

export function usePermissions(): { permissions: Set<string>; isLoading: boolean } {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const { data, isLoading } = useQuery({
    queryKey: ['permissions-me'],
    queryFn: () => api.get<{ data: string[] }>('/api/v1/permissions/me').then((r) => r.data),
    enabled: !!user && !isSuperAdmin,
  });

  const permissions = useMemo(() => {
    if (isSuperAdmin) return ALL_PERMISSIONS;
    if (!data) return new Set<string>();
    return new Set(data);
  }, [isSuperAdmin, data]);

  return { permissions, isLoading: !isSuperAdmin && isLoading };
}
