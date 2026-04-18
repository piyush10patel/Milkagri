import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AgentInfo {
  id: string;
  name: string;
  email: string;
}

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
}

interface Assignment {
  id: string;
  customerId: string;
  agentId: string;
  assignedAt: string;
  customer: CustomerInfo;
  agent: AgentInfo;
}

interface AssignmentListResponse {
  data: Assignment[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface UserListResponse {
  data: UserItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface CustomerOption {
  id: string;
  name: string;
}

export default function AgentAssignmentPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [agentFilter, setAgentFilter] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formAgentId, setFormAgentId] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const limit = 20;

  // Build query params for assignments list
  const assignmentParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(limit));
    if (agentFilter) p.set('agentId', agentFilter);
    return p.toString();
  }, [page, agentFilter]);

  // Fetch assignments
  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['agent-assignments', page, agentFilter],
    queryFn: () => api.get<AssignmentListResponse>(`/api/agent-assignments?${assignmentParams}`),
  });

  // Fetch delivery agents for dropdown
  const { data: agentsData } = useQuery({
    queryKey: ['delivery-agents'],
    queryFn: () => api.get<UserListResponse>('/api/users?limit=100'),
  });

  // Fetch customers for dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers-for-assignment'],
    queryFn: () => api.get<{ data: CustomerOption[] }>('/api/v1/customers?limit=500&status=active'),
  });

  // Filter to only delivery_agent role users
  const agents = useMemo(() => {
    return (agentsData?.data ?? [])
      .filter((u) => u.role === 'delivery_agent' && u.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agentsData]);

  const customers = useMemo(() => {
    return (customersData?.data ?? []).sort((a, b) => a.name.localeCompare(b.name));
  }, [customersData]);

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: (body: { customerId: string; agentId: string }) =>
      api.post('/api/agent-assignments', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-assignments'] });
      setFormCustomerId('');
      setFormAgentId('');
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to assign customer');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/agent-assignments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-assignments'] });
      setDeleteTarget(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!formCustomerId || !formAgentId) {
      setFormError('Please select both a customer and an agent');
      return;
    }
    assignMutation.mutate({ customerId: formCustomerId, agentId: formAgentId });
  }

  const assignments = assignmentsData?.data ?? [];
  const pagination = assignmentsData?.pagination;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Customer-Agent Assignments</h1>

      {/* Assignment form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Assign / Reassign Customer</h2>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label htmlFor="assign-customer" className="block text-xs text-gray-500 mb-1">Customer</label>
            <select
              id="assign-customer"
              value={formCustomerId}
              onChange={(e) => setFormCustomerId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="assign-agent" className="block text-xs text-gray-500 mb-1">Delivery Agent</label>
            <select
              id="assign-agent"
              value={formAgentId}
              onChange={(e) => setFormAgentId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={assignMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {assignMutation.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </div>
        {formError && <p className="mt-2 text-sm text-red-600" role="alert">{formError}</p>}
      </form>

      {/* Filter */}
      <div className="mb-4">
        <label htmlFor="filter-agent" className="block text-xs text-gray-500 mb-1">Filter by Agent</label>
        <select
          id="filter-agent"
          value={agentFilter}
          onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter assignments by agent"
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      {/* Assignments table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned At</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {assignments.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{a.customer.name}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{a.agent.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(a.assignedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <button
                    onClick={() => setDeleteTarget(a.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && !isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                  No assignments found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="delete-title" className="text-lg font-semibold text-gray-900 mb-2">Remove Assignment</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to remove this customer-agent assignment?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
