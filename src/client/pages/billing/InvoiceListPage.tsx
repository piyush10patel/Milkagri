import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface Invoice {
  id: string;
  customer: { id: string; name: string };
  billingCycleStart: string;
  billingCycleEnd: string;
  version: number;
  totalCharges: number;
  totalDiscounts: number;
  totalAdjustments: number;
  totalPayments: number;
  closingBalance: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  generatedAt: string;
}

interface ListResponse {
  data: Invoice[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-800',
  partial: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
};

export default function InvoiceListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    cycleStart: '',
    cycleEnd: '',
  });
  const [generateError, setGenerateError] = useState('');
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (statusFilter) params.set('paymentStatus', statusFilter);
  if (cycleFilter) {
    const [year, month] = cycleFilter.split('-');
    if (year && month) {
      const start = `${year}-${month}-01`;
      const end = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
      params.set('cycleStart', start);
      params.set('cycleEnd', end);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, statusFilter, customerSearch, cycleFilter],
    queryFn: () => api.get<ListResponse>(`/api/v1/billing/invoices?${params}`),
  });

  const generateMutation = useMutation({
    mutationFn: (payload: { cycleStart: string; cycleEnd: string }) =>
      api.post<{ invoicesCreated: number }>('/api/v1/billing/generate', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowGenerateModal(false);
      setGenerateForm({ cycleStart: '', cycleEnd: '' });
      setGenerateError('');
    },
    onError: (err: { message?: string }) => {
      setGenerateError(err.message ?? 'Failed to generate invoices');
    },
  });

  const filteredInvoices = data?.data?.filter((inv) =>
    customerSearch
      ? inv.customer.name.toLowerCase().includes(customerSearch.toLowerCase())
      : true,
  ) ?? [];

  function submitGenerateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setGenerateError('');
    generateMutation.mutate(generateForm);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Generate Invoices
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search customer…"
          value={customerSearch}
          onChange={(e) => { setCustomerSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search by customer"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by payment status"
        >
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
        <input
          type="month"
          value={cycleFilter}
          onChange={(e) => { setCycleFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by billing cycle"
        />
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Billing Period</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Charges</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredInvoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{inv.customer.name}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{inv.billingCycleStart} — {inv.billingCycleEnd}</td>
                <td className="px-4 py-3 text-sm text-right">₹{Number(inv.totalCharges).toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">₹{Number(inv.closingBalance).toFixed(2)}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.paymentStatus] ?? ''}`}>{inv.paymentStatus}</span>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <Link to={`/billing/${inv.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                </td>
              </tr>
            ))}
            {filteredInvoices.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No invoices found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="generate-invoices-title">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="generate-invoices-title" className="text-lg font-semibold text-gray-900 mb-3">Generate Invoices</h2>
            <form onSubmit={submitGenerateInvoice} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Cycle Start</label>
                <input
                  type="date"
                  value={generateForm.cycleStart}
                  onChange={(e) => setGenerateForm((current) => ({ ...current, cycleStart: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Cycle End</label>
                <input
                  type="date"
                  value={generateForm.cycleEnd}
                  onChange={(e) => setGenerateForm((current) => ({ ...current, cycleEnd: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              {generateError && <p className="text-sm text-red-600">{generateError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowGenerateModal(false);
                    setGenerateError('');
                  }}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {generateMutation.isPending ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
