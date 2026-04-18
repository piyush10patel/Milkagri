import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PermissionMatrix = { [role: string]: { [permission: string]: boolean } };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLES = ['super_admin', 'admin', 'billing_staff', 'delivery_agent', 'read_only'] as const;

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  billing_staff: 'Billing Staff',
  delivery_agent: 'Delivery Agent',
  read_only: 'Read Only',
};

const PERMISSION_NAMES = [
  'customers', 'products', 'pricing', 'subscriptions', 'orders',
  'milk_summary', 'milk_collection', 'deliveries', 'routes',
  'route_map', 'live_gps', 'billing', 'payments', 'reports',
  'users', 'notifications', 'audit_logs', 'settings',
  'collections_overview', 'agent_assignments', 'remittances',
  'agent_balances', 'agent_collections_dashboard',
] as const;

const PERMISSION_LABELS: Record<string, string> = {
  customers: 'Customers',
  products: 'Products',
  pricing: 'Pricing',
  subscriptions: 'Subscriptions',
  orders: 'Orders',
  milk_summary: 'Milk Summary',
  milk_collection: 'Milk Collection',
  deliveries: 'Deliveries',
  routes: 'Routes',
  route_map: 'Route Map',
  live_gps: 'Live GPS',
  billing: 'Billing',
  payments: 'Payments',
  reports: 'Reports',
  users: 'Users',
  notifications: 'Notifications',
  audit_logs: 'Audit Logs',
  settings: 'Settings',
  collections_overview: 'Collections Overview',
  agent_assignments: 'Agent Assignments',
  remittances: 'Remittances',
  agent_balances: 'Agent Balances',
  agent_collections_dashboard: 'Agent Collections Dashboard',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PermissionMatrixPage() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const { data: matrix, isLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get<{ data: PermissionMatrix }>('/api/v1/permissions').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { role: string; permission: string; granted: boolean }) =>
      api.put('/api/v1/permissions', vars),
    onMutate: async (vars) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['permissions'] });

      // Snapshot previous value
      const previous = queryClient.getQueryData<PermissionMatrix>(['permissions']);

      // Optimistically update
      if (previous) {
        const updated = { ...previous };
        updated[vars.role] = { ...updated[vars.role], [vars.permission]: vars.granted };
        queryClient.setQueryData(['permissions'], updated);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Revert optimistic update
      if (context?.previous) {
        queryClient.setQueryData(['permissions'], context.previous);
      }
      setToast({ message: 'Failed to update permission. Please try again.', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    },
    onSuccess: () => {
      setToast({ message: 'Permission updated.', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
  });

  function handleToggle(role: string, permission: string, currentValue: boolean) {
    toggleMutation.mutate({ role, permission, granted: !currentValue });
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500" aria-live="polite">Loading permissions…</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Permission Matrix</h1>

      {/* Toast notification */}
      {toast && (
        <div
          role="alert"
          className={`mb-4 rounded-md px-4 py-2 text-sm ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10"
              >
                Permission
              </th>
              {ROLES.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                >
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {PERMISSION_NAMES.map((perm) => (
              <tr key={perm} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm text-gray-900 sticky left-0 bg-white z-10">
                  {PERMISSION_LABELS[perm]}
                </td>
                {ROLES.map((role) => {
                  const isSuperAdmin = role === 'super_admin';
                  const granted = isSuperAdmin
                    ? true
                    : matrix?.[role]?.[perm] ?? false;

                  return (
                    <td key={role} className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={granted}
                        disabled={isSuperAdmin}
                        onChange={() => {
                          if (!isSuperAdmin) handleToggle(role, perm, granted);
                        }}
                        aria-label={`${PERMISSION_LABELS[perm]} for ${ROLE_LABELS[role]}`}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
