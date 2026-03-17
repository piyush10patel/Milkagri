import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: 'active' | 'paused' | 'stopped';
  route?: { id: string; name: string };
  createdAt: string;
}

interface ListResponse {
  data: Customer[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function CustomerListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: string } | null>(null);
  const closeConfirm = useCallback(() => setConfirmAction(null), []);
  const { modalRef: confirmModalRef } = useModalFocusTrap(!!confirmAction, closeConfirm);
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortOrder });
  if (search) params.set('search', search);
  if (statusFilter) params.set('status', statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, statusFilter, sortBy, sortOrder],
    queryFn: () => api.get<ListResponse>(`/api/v1/customers?${params}`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/customers/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setConfirmAction(null);
    },
  });

  function handleSort(col: string) {
    if (sortBy === col) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('asc'); }
  }

  const sortIcon = (col: string) => sortBy === col ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '';

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = { active: 'bg-green-100 text-green-800', paused: 'bg-yellow-100 text-yellow-800', stopped: 'bg-red-100 text-red-800' };
    return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[s] ?? 'bg-gray-100 text-gray-800'}`}>{s}</span>;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Customers</h1>
        <Link to="/customers/new" className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + New Customer
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search name, phone, address…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search customers"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="stopped">Stopped</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('name')} tabIndex={0} role="button" onKeyDown={(e) => e.key === 'Enter' && handleSort('name')}>Name{sortIcon('name')}</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('phone')} tabIndex={0} role="button" onKeyDown={(e) => e.key === 'Enter' && handleSort('phone')}>Phone{sortIcon('phone')}</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('status')} tabIndex={0} role="button" onKeyDown={(e) => e.key === 'Enter' && handleSort('status')}>Status{sortIcon('status')}</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.data?.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm"><Link to={`/customers/${c.id}`} className="text-blue-600 hover:underline">{c.name}</Link></td>
                <td className="px-4 py-3 text-sm text-gray-700">{c.phone}</td>
                <td className="px-4 py-3 text-sm">{statusBadge(c.status)}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{c.route?.name ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-right space-x-2">
                  <Link to={`/customers/${c.id}/edit`} className="text-blue-600 hover:underline text-xs">Edit</Link>
                  {c.status === 'active' && (
                    <>
                      <button onClick={() => setConfirmAction({ id: c.id, status: 'paused' })} className="text-yellow-600 hover:underline text-xs">Pause</button>
                      <button onClick={() => setConfirmAction({ id: c.id, status: 'stopped' })} className="text-red-600 hover:underline text-xs">Stop</button>
                    </>
                  )}
                  {c.status === 'paused' && (
                    <button onClick={() => setConfirmAction({ id: c.id, status: 'active' })} className="text-green-600 hover:underline text-xs">Reactivate</button>
                  )}
                  {c.status === 'stopped' && (
                    <button onClick={() => setConfirmAction({ id: c.id, status: 'active' })} className="text-green-600 hover:underline text-xs">Reactivate</button>
                  )}
                </td>
              </tr>
            ))}
            {data?.data?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No customers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="confirm-status-title">
          <div ref={confirmModalRef} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="confirm-status-title" className="text-lg font-semibold text-gray-900 mb-2">Confirm Status Change</h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to change this customer's status to <span className="font-medium">{confirmAction.status}</span>?
              {confirmAction.status === 'paused' && ' All active subscriptions will be suspended.'}
              {confirmAction.status === 'stopped' && ' All active subscriptions will be cancelled.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={closeConfirm} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
              <button
                onClick={() => statusMutation.mutate(confirmAction)}
                disabled={statusMutation.isPending}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {statusMutation.isPending ? 'Updating…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
