import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface LedgerEntry {
  id: string;
  entryDate: string;
  transactionType: 'charge' | 'payment' | 'adjustment' | 'credit_applied';
  referenceType?: string;
  referenceId?: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  description?: string;
}

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
}

interface LedgerResponse {
  data: LedgerEntry[];
  customer?: CustomerInfo;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const TYPE_COLORS: Record<string, string> = {
  charge: 'bg-red-100 text-red-800',
  payment: 'bg-green-100 text-green-800',
  adjustment: 'bg-blue-100 text-blue-800',
  credit_applied: 'bg-purple-100 text-purple-800',
};

export default function CustomerLedgerPage() {
  const { customerId } = useParams();
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const limit = 30;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-ledger', customerId, page, startDate, endDate],
    queryFn: () => api.get<LedgerResponse>(`/api/v1/customers/${customerId}/ledger?${params}`),
  });

  const { data: customerData } = useQuery({
    queryKey: ['customer-info', customerId],
    queryFn: () => api.get<{ data: CustomerInfo }>(`/api/v1/customers/${customerId}`),
  });

  const customer = customerData?.data ?? data?.customer;
  const entries = data?.data ?? [];
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;

  const pdfParams = new URLSearchParams();
  if (startDate) pdfParams.set('startDate', startDate);
  if (endDate) pdfParams.set('endDate', endDate);
  const pdfUrl = `/api/v1/customers/${customerId}/ledger/pdf${pdfParams.toString() ? '?' + pdfParams : ''}`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <Link to={`/customers/${customerId}`} className="text-sm text-blue-600 hover:underline print:hidden">← Customer</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">
            Ledger {customer ? `— ${customer.name}` : ''}
          </h1>
        </div>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 print:hidden"
          aria-label="Export ledger as PDF"
        >
          📄 Export PDF
        </a>
      </div>

      {/* Current balance */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <p className="text-xs text-gray-500">Current Outstanding Balance</p>
        <p className={`text-2xl font-bold ${currentBalance > 0 ? 'text-red-700' : currentBalance < 0 ? 'text-green-700' : 'text-gray-900'}`}>
          ₹{Number(currentBalance).toFixed(2)}
        </p>
      </div>

      {/* Date range filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 print:hidden">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Ledger start date"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Ledger end date"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
            className="text-sm text-blue-600 hover:underline"
            aria-label="Clear date filter"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      {/* Ledger table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{e.entryDate}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[e.transactionType] ?? 'bg-gray-100 text-gray-800'}`}>
                    {e.transactionType.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{e.description || '—'}</td>
                <td className="px-4 py-3 text-sm text-right">{e.debitAmount > 0 ? `₹${Number(e.debitAmount).toFixed(2)}` : '—'}</td>
                <td className="px-4 py-3 text-sm text-right">{e.creditAmount > 0 ? `₹${Number(e.creditAmount).toFixed(2)}` : '—'}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">₹{Number(e.runningBalance).toFixed(2)}</td>
              </tr>
            ))}
            {entries.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No ledger entries found</td></tr>
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
