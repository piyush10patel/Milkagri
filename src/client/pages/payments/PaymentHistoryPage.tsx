import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface PaymentItem {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentMethodDescription?: string | null;
  paymentDate: string;
  isFieldCollection: boolean;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  invoice?: {
    id: string;
    billingCycleStart: string;
    billingCycleEnd: string;
  } | null;
  collector?: {
    id: string;
    name: string;
  } | null;
  recorder?: {
    id: string;
    name: string;
  } | null;
}

interface ListResponse {
  data: PaymentItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function PaymentHistoryPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['payments-history', page],
    queryFn: () => api.get<ListResponse>(`/api/v1/payments?${params}`),
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <Link to="/payments" className="text-sm text-blue-600 hover:underline">← Outstanding</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Payment History</h1>
        </div>
        <Link to="/payments/new" className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Record Payment
        </Link>
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading...</p>}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.data.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-700">{payment.paymentDate}</td>
                <td className="px-4 py-3 text-sm">
                  <Link to={`/customers/${payment.customer.id}`} className="text-blue-600 hover:underline">
                    {payment.customer.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {payment.invoice ? (
                    <Link to={`/billing/${payment.invoice.id}`} className="text-blue-600 hover:underline">
                      {payment.invoice.billingCycleStart} - {payment.invoice.billingCycleEnd}
                    </Link>
                  ) : (
                    'Advance payment'
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <div>{payment.paymentMethod}</div>
                  {payment.isFieldCollection && (
                    <div className="text-xs text-gray-500">
                      Field collection{payment.collector ? ` by ${payment.collector.name}` : ''}
                    </div>
                  )}
                  {payment.paymentMethod === 'other' && payment.paymentMethodDescription && (
                    <div className="text-xs text-gray-500">{payment.paymentMethodDescription}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{payment.recorder?.name ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">₹{Number(payment.amount).toFixed(2)}</td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No payments found</td>
              </tr>
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
