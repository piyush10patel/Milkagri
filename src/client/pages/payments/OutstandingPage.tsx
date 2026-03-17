import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface OutstandingCustomer {
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalOutstanding: number;
  invoiceCount: number;
  oldestUnpaidDate?: string;
}

interface ReconciliationEntry {
  agentId: string;
  agentName: string;
  totalCollected: number;
  totalHandedOver: number;
  discrepancy: number;
}

interface ListResponse {
  data: OutstandingCustomer[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function OutstandingPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('totalOutstanding');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconDate, setReconDate] = useState(() => new Date().toISOString().slice(0, 10));
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortOrder });

  const { data, isLoading } = useQuery({
    queryKey: ['outstanding', page, sortBy, sortOrder],
    queryFn: () => api.get<ListResponse>(`/api/v1/payments/outstanding?${params}`),
  });

  const { data: reconData } = useQuery({
    queryKey: ['payment-reconciliation', reconDate],
    queryFn: () => api.get<{ data: ReconciliationEntry[] }>(`/api/v1/payments/reconciliation?date=${reconDate}`),
    enabled: showReconciliation,
  });

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  function handleSort(col: string) {
    if (sortBy === col) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('desc'); }
  }

  const sortIcon = (col: string) => sortBy === col ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Outstanding Payments</h1>
        <div className="flex gap-2">
          <Link to="/payments/new" className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Record Payment
          </Link>
          {isAdmin && (
            <button
              onClick={() => setShowReconciliation(!showReconciliation)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              aria-label="Toggle collection reconciliation"
            >
              Reconciliation
            </button>
          )}
        </div>
      </div>

      {/* Collection Reconciliation (Admin only) */}
      {showReconciliation && isAdmin && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Collection Reconciliation</h2>
            <input
              type="date"
              value={reconDate}
              onChange={(e) => setReconDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              aria-label="Reconciliation date"
            />
          </div>
          {reconData?.data?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead><tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Agent</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500">Collected</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500">Handed Over</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500">Discrepancy</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {reconData.data.map((r) => (
                    <tr key={r.agentId}>
                      <td className="px-3 py-2">{r.agentName}</td>
                      <td className="px-3 py-2 text-right">₹{Number(r.totalCollected).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">₹{Number(r.totalHandedOver).toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${r.discrepancy !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{Number(r.discrepancy).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-gray-500">No collection data for this date</p>}
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      {/* Outstanding table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('totalOutstanding')} tabIndex={0} role="button" onKeyDown={(e) => e.key === 'Enter' && handleSort('totalOutstanding')}>Outstanding{sortIcon('totalOutstanding')}</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invoices</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('oldestUnpaidDate')} tabIndex={0} role="button" onKeyDown={(e) => e.key === 'Enter' && handleSort('oldestUnpaidDate')}>Oldest Unpaid{sortIcon('oldestUnpaidDate')}</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.data?.map((c) => (
              <tr key={c.customerId} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm"><Link to={`/customers/${c.customerId}`} className="text-blue-600 hover:underline">{c.customerName}</Link></td>
                <td className="px-4 py-3 text-sm text-gray-700">{c.customerPhone}</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-red-700">₹{Number(c.totalOutstanding).toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-right">{c.invoiceCount}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{c.oldestUnpaidDate ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <Link to={`/payments/new?customerId=${c.customerId}`} className="text-blue-600 hover:underline text-xs">Pay</Link>
                </td>
              </tr>
            ))}
            {data?.data?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No outstanding payments</td></tr>
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
    </div>
  );
}
