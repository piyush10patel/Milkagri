import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AgentInfo {
  id: string;
  name: string;
  email: string;
}

interface ReceiverInfo {
  id: string;
  name: string;
  email: string;
}

interface Remittance {
  id: string;
  agentId: string;
  amount: string | number;
  paymentMethod: string;
  remittanceDate: string;
  notes: string | null;
  createdAt: string;
  agent: AgentInfo;
  receiver: ReceiverInfo;
}

interface RemittanceListResponse {
  data: Remittance[];
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

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
] as const;

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currency(value: string | number): string {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatMethod(method: string): string {
  const entry = PAYMENT_METHODS.find((m) => m.value === method);
  return entry?.label ?? method;
}

export default function AgentRemittancePage() {
  const queryClient = useQueryClient();

  // Form state
  const [formAgentId, setFormAgentId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('cash');
  const [formDate, setFormDate] = useState(todayStr);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Filter state
  const [agentFilter, setAgentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Build query params for remittances list
  const listParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(limit));
    if (agentFilter) p.set('agentId', agentFilter);
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    return p.toString();
  }, [page, agentFilter, startDate, endDate]);

  // Fetch remittances
  const { data: remittancesData, isLoading } = useQuery({
    queryKey: ['agent-remittances', page, agentFilter, startDate, endDate],
    queryFn: () => api.get<RemittanceListResponse>(`/api/agent-remittances?${listParams}`),
  });

  // Fetch delivery agents for dropdowns
  const { data: agentsData } = useQuery({
    queryKey: ['delivery-agents'],
    queryFn: () => api.get<UserListResponse>('/api/users?limit=100'),
  });

  // Filter to only delivery_agent role users
  const agents = useMemo(() => {
    return (agentsData?.data ?? [])
      .filter((u) => u.role === 'delivery_agent' && u.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [agentsData]);

  // Record remittance mutation
  const recordMutation = useMutation({
    mutationFn: (body: {
      agentId: string;
      amount: number;
      paymentMethod: string;
      remittanceDate: string;
      notes?: string;
    }) => api.post('/api/agent-remittances', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-remittances'] });
      queryClient.invalidateQueries({ queryKey: ['agent-balances'] });
      setFormAgentId('');
      setFormAmount('');
      setFormPaymentMethod('cash');
      setFormDate(todayStr());
      setFormNotes('');
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to record remittance');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!formAgentId) {
      setFormError('Please select a delivery agent');
      return;
    }
    const amount = parseFloat(formAmount);
    if (!formAmount || isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid positive amount');
      return;
    }
    if (!formDate) {
      setFormError('Please select a date');
      return;
    }
    recordMutation.mutate({
      agentId: formAgentId,
      amount,
      paymentMethod: formPaymentMethod,
      remittanceDate: formDate,
      notes: formNotes || undefined,
    });
  }

  const remittances = remittancesData?.data ?? [];
  const pagination = remittancesData?.pagination;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Agent Remittances</h1>

      {/* Record remittance form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Record Remittance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label htmlFor="remit-agent" className="block text-xs text-gray-500 mb-1">Delivery Agent</label>
            <select
              id="remit-agent"
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
          <div>
            <label htmlFor="remit-amount" className="block text-xs text-gray-500 mb-1">Amount (₹)</label>
            <input
              id="remit-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="remit-method" className="block text-xs text-gray-500 mb-1">Payment Method</label>
            <select
              id="remit-method"
              value={formPaymentMethod}
              onChange={(e) => setFormPaymentMethod(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="remit-date" className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              id="remit-date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="remit-notes" className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <input
              id="remit-notes"
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional notes…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={recordMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {recordMutation.isPending ? 'Recording…' : 'Record Remittance'}
          </button>
          {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}
        </div>
      </form>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div>
          <label htmlFor="filter-remit-agent" className="block text-xs text-gray-500 mb-1">Filter by Agent</label>
          <select
            id="filter-remit-agent"
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter remittances by agent"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-remit-start" className="block text-xs text-gray-500 mb-1">Start Date</label>
          <input
            id="filter-remit-start"
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="filter-remit-end" className="block text-xs text-gray-500 mb-1">End Date</label>
          <input
            id="filter-remit-end"
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      {/* Remittances table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received By</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {remittances.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{r.agent.name}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">{currency(r.amount)}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{formatMethod(r.paymentMethod)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(r.remittanceDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{r.receiver.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{r.notes || '—'}</td>
              </tr>
            ))}
            {remittances.length === 0 && !isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No remittances found
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
    </div>
  );
}
