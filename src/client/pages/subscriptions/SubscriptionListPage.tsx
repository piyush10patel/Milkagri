import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';
import { Plus, PauseCircle, XCircle, Trash2, CalendarClock, Sigma, History, ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageLoader } from '@/components/ui/spinner';

interface Subscription {
  id: string;
  customer: { id: string; name: string };
  subscriptionType?: 'regular' | 'sub_subscription';
  parentSubscription?: { id: string; customer?: { id: string; name: string } } | null;
  parentSubscriptionId?: string | null;
  route?: { id: string; name: string } | null;
  productVariant: { id: string; product: { name: string }; unitType: string; quantityPerUnit: number };
  quantity: number;
  rolledUpQuantity?: number;
  childSubscriptionCount?: number;
  childSubscriptionQuantity?: number;
  isRolledIntoParent?: boolean;
  deliverySession: 'morning' | 'evening';
  packs?: Array<{ packSize: number | string; packCount: number }>;
  frequencyType: string;
  status: 'active' | 'paused' | 'cancelled';
  startDate: string;
  endDate?: string;
}

interface ListResponse { data: Subscription[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

const FREQ_LABELS: Record<string, string> = { daily: 'Daily', alternate_day: 'Alt Day', custom_weekday: 'Custom' };

function fmtDate(value?: string) { return value ? value.slice(0, 10) : '—'; }

export default function SubscriptionListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [holdTarget, setHoldTarget] = useState<string | null>(null);
  const [holdForm, setHoldForm] = useState({ startDate: '', endDate: '' });
  const [qtyTarget, setQtyTarget] = useState<string | null>(null);
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
    mutationFn: ({ id, data: d }: { id: string; data: { startDate: string; endDate: string } }) =>
      api.post(`/api/v1/subscriptions/${id}/vacation-holds`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscriptions'] }); setHoldTarget(null); setHoldForm({ startDate: '', endDate: '' }); },
  });

  const qtyMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: { newQuantity: number; effectiveDate: string } }) =>
      api.post(`/api/v1/subscriptions/${id}/quantity-changes`, d),
    onSuccess: () => { setQtyTarget(null); setQtyForm({ newQuantity: '', effectiveDate: '' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/subscriptions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscriptions'] }); setDeleteTarget(null); },
  });

  const columns: Column<Subscription>[] = [
    { key: 'customer', label: 'Customer', render: (row) => (
      <Link to={`/customers/${row.customer.id}`} className="font-medium text-primary-600 hover:text-primary-700 transition-colors">{row.customer.name}</Link>
    )},
    { key: 'subscriptionType', label: 'Type', render: (row) => (
      row.subscriptionType === 'sub_subscription'
        ? <Badge variant="info">Sub-sub</Badge>
        : <Badge variant="neutral">Regular</Badge>
    )},
    { key: 'productVariant', label: 'Product', render: (row) => (
      <span className="text-neutral-900 text-xs">{row.productVariant?.product?.name} ({row.productVariant?.quantityPerUnit} {row.productVariant?.unitType})</span>
    )},
    { key: 'quantity', label: 'Qty', align: 'right', render: (row) => (
      <div>
        <span className="font-medium">{row.subscriptionType === 'sub_subscription' ? row.quantity : (row.rolledUpQuantity ?? row.quantity)}</span>
        {row.packs?.length ? <div className="text-[10px] text-neutral-400">{row.packs.map((p) => `${p.packCount}x${Number(p.packSize)}L`).join(', ')}</div> : null}
        {row.subscriptionType !== 'sub_subscription' && (row.childSubscriptionCount ?? 0) > 0 && (
          <div className="text-[10px] text-primary-500">+{row.childSubscriptionCount} sub: {row.childSubscriptionQuantity}</div>
        )}
      </div>
    )},
    { key: 'deliverySession', label: 'Session', render: (row) => <StatusBadge status={row.deliverySession} /> },
    { key: 'route', label: 'Route', render: (row) => <span className="text-neutral-600">{row.route?.name ?? '—'}</span> },
    { key: 'frequencyType', label: 'Freq', render: (row) => <span className="text-neutral-600 text-xs">{FREQ_LABELS[row.frequencyType] ?? row.frequencyType}</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'startDate', label: 'Start', format: (v) => fmtDate(v as string) },
    { key: 'actions', label: 'Actions', align: 'right', sortable: false, render: (row) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Link to={`/subscriptions/${row.id}/edit`}><Button variant="ghost" size="sm">Edit</Button></Link>
        {row.subscriptionType !== 'sub_subscription' && (
          <Link to={`/subscriptions/new?type=sub_subscription&parentId=${row.id}`}><Button variant="ghost" size="sm">Sub</Button></Link>
        )}
        {row.status === 'active' && (
          <>
            <button onClick={() => { setHoldTarget(row.id); setHoldForm({ startDate: '', endDate: '' }); }} className="rounded-lg p-1.5 text-neutral-400 hover:text-warning-600 hover:bg-warning-50 transition-colors" title="Vacation hold"><CalendarClock className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setQtyTarget(row.id); setQtyForm({ newQuantity: '', effectiveDate: '' }); }} className="rounded-lg p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Quantity change"><Sigma className="h-3.5 w-3.5" /></button>
            <button onClick={() => setCancelTarget(row.id)} className="rounded-lg p-1.5 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 transition-colors" title="Cancel"><XCircle className="h-3.5 w-3.5" /></button>
          </>
        )}
        <button onClick={() => setDeleteTarget(row.id)} className="rounded-lg p-1.5 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
        <button onClick={() => setHistoryTarget(historyTarget === row.id ? null : row.id)} className={`rounded-lg p-1.5 transition-colors ${historyTarget === row.id ? 'text-primary-600 bg-primary-50' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'}`} title="History"><History className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description={`${data?.pagination?.total ?? 0} total subscriptions`}
        actions={
          <Link to="/subscriptions/new">
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> New Subscription</Button>
          </Link>
        }
      />

      <Card>
        <div className="px-4 pt-4 pb-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          emptyTitle="No subscriptions found"
          emptyDescription="Create a subscription to get started."
          emptyAction={<Link to="/subscriptions/new"><Button size="sm"><Plus className="h-3.5 w-3.5" /> Add Subscription</Button></Link>}
          pageSize={limit}
        />
      </Card>

      {/* Inline history panel */}
      {historyTarget && (
        <Card>
          <SubscriptionHistory subscriptionId={historyTarget} onClose={() => setHistoryTarget(null)} />
        </Card>
      )}

      {/* Cancel modal */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)} title="Cancel Subscription" description="This will set the end date to today." size="sm">
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => setCancelTarget(null)}>No</Button>
          <Button variant="danger" onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget)} loading={cancelMutation.isPending}>Yes, Cancel</Button>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Subscription" description="This permanently removes the subscription. If it has delivery/invoice history, use Cancel instead." size="sm">
        {deleteMutation.isError && <p className="text-sm text-danger-600 mb-3">Failed to delete. Use Cancel instead.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)} loading={deleteMutation.isPending}>Delete</Button>
        </div>
      </Modal>

      {/* Hold modal */}
      <Modal open={!!holdTarget} onClose={() => setHoldTarget(null)} title="Create Vacation Hold" size="sm">
        <form onSubmit={(e) => { e.preventDefault(); holdTarget && holdMutation.mutate({ id: holdTarget, data: holdForm }); }} className="space-y-4">
          <Input label="Start Date" type="date" value={holdForm.startDate} onChange={(e) => setHoldForm({ ...holdForm, startDate: e.target.value })} required />
          <Input label="End Date" type="date" value={holdForm.endDate} onChange={(e) => setHoldForm({ ...holdForm, endDate: e.target.value })} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setHoldTarget(null)}>Cancel</Button>
            <Button type="submit" loading={holdMutation.isPending}>Create Hold</Button>
          </div>
        </form>
      </Modal>

      {/* Quantity modal */}
      <Modal open={!!qtyTarget} onClose={() => setQtyTarget(null)} title="Schedule Quantity Change" size="sm">
        <form onSubmit={(e) => { e.preventDefault(); qtyTarget && qtyMutation.mutate({ id: qtyTarget, data: { newQuantity: Number(qtyForm.newQuantity), effectiveDate: qtyForm.effectiveDate } }); }} className="space-y-4">
          <Input label="New Quantity" type="number" step="0.001" min="0.001" value={qtyForm.newQuantity} onChange={(e) => setQtyForm({ ...qtyForm, newQuantity: e.target.value })} required />
          <Input label="Effective Date" type="date" value={qtyForm.effectiveDate} onChange={(e) => setQtyForm({ ...qtyForm, effectiveDate: e.target.value })} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setQtyTarget(null)}>Cancel</Button>
            <Button type="submit" loading={qtyMutation.isPending}>Schedule Change</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}

function SubscriptionHistory({ subscriptionId, onClose }: { subscriptionId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['subscription-history', subscriptionId],
    queryFn: () => api.get<{ data: Array<{ id: string; changeType: string; oldValue?: string; newValue?: string; createdAt: string }> }>(`/api/v1/subscriptions/${subscriptionId}/history`),
  });

  return (
    <div>
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-neutral-500" />
          <h2 className="text-sm font-semibold text-neutral-900">Change History</h2>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors" aria-label="Close history">
          <XCircle className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
        {isLoading && <p className="text-sm text-neutral-500 text-center py-4">Loading...</p>}
        {!isLoading && (!data?.data?.length) && <p className="text-sm text-neutral-400 text-center py-4">No history found</p>}
        {data?.data?.map((h) => (
          <div key={h.id} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="font-medium text-neutral-900 capitalize">{h.changeType.replace(/_/g, ' ')}</span>
              <span className="text-[10px] text-neutral-400">{new Date(h.createdAt).toLocaleString()}</span>
            </div>
            {(h.oldValue || h.newValue) && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-600">
                <span className="bg-neutral-200 px-1.5 py-0.5 rounded">{h.oldValue ?? '—'}</span>
                <span>→</span>
                <span className="bg-primary-100 px-1.5 py-0.5 rounded text-primary-700">{h.newValue ?? '—'}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
