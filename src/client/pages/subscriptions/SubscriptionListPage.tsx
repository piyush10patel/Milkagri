import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

interface Subscription {
  id: string;
  customer: { id: string; name: string };
  route?: { id: string; name: string } | null;
  productVariant: { id: string; product: { name: string }; unitType: string; quantityPerUnit: number };
  quantity: number;
  deliverySession: 'morning' | 'evening';
  packs?: Array<{ packSize: number | string; packCount: number }>;
  frequencyType: string;
  status: 'active' | 'paused' | 'cancelled';
  startDate: string;
  endDate?: string;
}

interface ListResponse { data: Subscription[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

const FREQ_LABELS: Record<string, string> = { daily: 'Daily', alternate_day: 'Alternate Day', custom_weekday: 'Custom Weekday' };
const STATUS_COLORS: Record<string, string> = { active: 'bg-green-100 text-green-800', paused: 'bg-yellow-100 text-yellow-800', cancelled: 'bg-red-100 text-red-800' };

function formatDateOnly(value?: string) {
  return value ? value.slice(0, 10) : '—';
}

export default function SubscriptionListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const closeDeleteModal = useCallback(() => setDeleteTarget(null), []);
  const { modalRef: deleteModalRef } = useModalFocusTrap(!!deleteTarget, closeDeleteModal);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const closeCancelModal = useCallback(() => setCancelTarget(null), []);
  const { modalRef: cancelModalRef } = useModalFocusTrap(!!cancelTarget, closeCancelModal);
  const [holdTarget, setHoldTarget] = useState<string | null>(null);
  const closeHoldModal = useCallback(() => { setHoldTarget(null); setHoldForm({ startDate: '', endDate: '' }); }, []);
  const { modalRef: holdModalRef } = useModalFocusTrap(!!holdTarget, closeHoldModal);
  const [holdForm, setHoldForm] = useState({ startDate: '', endDate: '' });
  const [qtyTarget, setQtyTarget] = useState<string | null>(null);
  const closeQtyModal = useCallback(() => { setQtyTarget(null); setQtyForm({ newQuantity: '', effectiveDate: '' }); }, []);
  const { modalRef: qtyModalRef } = useModalFocusTrap(!!qtyTarget, closeQtyModal);
  const [qtyForm, setQtyForm] = useState({ newQuantity: '', effectiveDate: '' });
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (statusFilter) params.set('status', statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', page, statusFilter],
    queryFn: () => api.get<ListResponse>(`/api/v1/subscriptions?${params}`),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/subscriptions/${id}/cancel`, { endDate: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscriptions'] }); setCancelTarget(null); },
  });

  const holdMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { startDate: string; endDate: string } }) =>
      api.post(`/api/v1/subscriptions/${id}/vacation-holds`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscriptions'] }); setHoldTarget(null); setHoldForm({ startDate: '', endDate: '' }); },
  });

  const qtyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { newQuantity: number; effectiveDate: string } }) =>
      api.post(`/api/v1/subscriptions/${id}/quantity-changes`, data),
    onSuccess: () => { setQtyTarget(null); setQtyForm({ newQuantity: '', effectiveDate: '' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/subscriptions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setDeleteTarget(null);
    },
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Subscriptions</h1>
        <Link to="/subscriptions/new" className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">+ New Subscription</Link>
      </div>

      <div className="mb-4">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.data?.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm"><Link to={`/customers/${s.customer.id}`} className="text-blue-600 hover:underline">{s.customer.name}</Link></td>
                <td className="px-4 py-3 text-sm">{s.productVariant?.product?.name} ({s.productVariant?.quantityPerUnit} {s.productVariant?.unitType})</td>
                <td className="px-4 py-3 text-sm">
                  <div>{s.quantity}</div>
                  <div className="text-xs text-gray-500">
                    {s.packs?.length ? s.packs.map((pack) => `${pack.packCount} x ${Number(pack.packSize)}L`).join(', ') : 'No packs'}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm capitalize">{s.deliverySession}</td>
                <td className="px-4 py-3 text-sm">{s.route?.name ?? '—'}</td>
                <td className="px-4 py-3 text-sm">{FREQ_LABELS[s.frequencyType] ?? s.frequencyType}</td>
                <td className="px-4 py-3 text-sm"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] ?? ''}`}>{s.status}</span></td>
                <td className="px-4 py-3 text-sm">{formatDateOnly(s.startDate)}</td>
                <td className="px-4 py-3 text-sm text-right space-x-1">
                  <Link to={`/subscriptions/${s.id}/edit`} className="text-blue-600 hover:underline text-xs">Edit</Link>
                  {s.status === 'active' && (
                    <>
                      <button onClick={() => setHoldTarget(s.id)} className="text-yellow-600 hover:underline text-xs">Hold</button>
                      <button onClick={() => setQtyTarget(s.id)} className="text-purple-600 hover:underline text-xs">Qty</button>
                      <button onClick={() => setCancelTarget(s.id)} className="text-red-600 hover:underline text-xs">Cancel</button>
                    </>
                  )}
                  <button onClick={() => setDeleteTarget(s.id)} className="text-red-700 hover:underline text-xs">Delete</button>
                  <button onClick={() => setHistoryTarget(historyTarget === s.id ? null : s.id)} className="text-gray-600 hover:underline text-xs">History</button>
                </td>
              </tr>
            ))}
            {data?.data?.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">No subscriptions found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {data.pagination.page} of {data.pagination.totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {/* Change history inline */}
      {historyTarget && <SubscriptionHistory subscriptionId={historyTarget} onClose={() => setHistoryTarget(null)} />}

      {/* Cancel confirmation */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="cancel-sub-title">
          <div ref={cancelModalRef} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="cancel-sub-title" className="text-lg font-semibold text-gray-900 mb-2">Cancel Subscription</h2>
            <p className="text-sm text-gray-600 mb-4">Are you sure? This will set the end date to today.</p>
            <div className="flex justify-end gap-2">
              <button onClick={closeCancelModal} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">No</button>
              <button onClick={() => cancelMutation.mutate(cancelTarget)} disabled={cancelMutation.isPending} className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50">
                {cancelMutation.isPending ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="delete-sub-title">
          <div ref={deleteModalRef} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="delete-sub-title" className="text-lg font-semibold text-gray-900 mb-2">Delete Subscription</h2>
            <p className="text-sm text-gray-600 mb-4">
              This permanently removes the subscription. If it already has delivered or invoiced history, deletion will be blocked and you should cancel it instead.
            </p>
            {deleteMutation.isError && (
              <p className="mb-4 text-sm text-red-600">
                Failed to delete subscription. If this subscription already has delivery or invoice history, use Cancel instead.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={closeDeleteModal} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget)} disabled={deleteMutation.isPending} className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vacation hold dialog */}
      {holdTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="hold-title">
          <div ref={holdModalRef} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="hold-title" className="text-lg font-semibold text-gray-900 mb-3">Create Vacation Hold</h2>
            <form onSubmit={(e) => { e.preventDefault(); holdMutation.mutate({ id: holdTarget, data: holdForm }); }} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Start Date</label>
                <input type="date" value={holdForm.startDate} onChange={(e) => setHoldForm({ ...holdForm, startDate: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">End Date</label>
                <input type="date" value={holdForm.endDate} onChange={(e) => setHoldForm({ ...holdForm, endDate: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeHoldModal} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
                <button type="submit" disabled={holdMutation.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                  {holdMutation.isPending ? 'Creating…' : 'Create Hold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quantity change dialog */}
      {qtyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="qty-title">
          <div ref={qtyModalRef} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="qty-title" className="text-lg font-semibold text-gray-900 mb-3">Schedule Quantity Change</h2>
            <form onSubmit={(e) => { e.preventDefault(); qtyMutation.mutate({ id: qtyTarget, data: { newQuantity: Number(qtyForm.newQuantity), effectiveDate: qtyForm.effectiveDate } }); }} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">New Quantity</label>
                <input type="number" step="0.001" min="0.001" value={qtyForm.newQuantity} onChange={(e) => setQtyForm({ ...qtyForm, newQuantity: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Effective Date</label>
                <input type="date" value={qtyForm.effectiveDate} onChange={(e) => setQtyForm({ ...qtyForm, effectiveDate: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeQtyModal} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
                <button type="submit" disabled={qtyMutation.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                  {qtyMutation.isPending ? 'Scheduling…' : 'Schedule Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SubscriptionHistory({ subscriptionId, onClose }: { subscriptionId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['subscription-history', subscriptionId],
    queryFn: () => api.get<{ data: Array<{ id: string; changeType: string; oldValue?: string; newValue?: string; createdAt: string }> }>(`/api/v1/subscriptions/${subscriptionId}/history`),
  });

  const { modalRef: historyModalRef } = useModalFocusTrap(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <div ref={historyModalRef} className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 id="history-title" className="text-lg font-semibold text-gray-900">Change History</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close history">✕</button>
        </div>
        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {data?.data?.length === 0 && <p className="text-sm text-gray-500">No history</p>}
        <div className="space-y-2">
          {data?.data?.map((h) => (
            <div key={h.id} className="border border-gray-100 rounded p-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{h.changeType.replace(/_/g, ' ')}</span>
                <span className="text-xs text-gray-500">{new Date(h.createdAt).toLocaleString()}</span>
              </div>
              {(h.oldValue || h.newValue) && (
                <p className="text-xs text-gray-600 mt-1">{h.oldValue ?? '—'} → {h.newValue ?? '—'}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
