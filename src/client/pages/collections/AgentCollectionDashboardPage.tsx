import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface CustomerInfo {
  id: string;
  name: string;
  phone: string | null;
}

interface DashboardCustomer {
  customer: CustomerInfo;
  balance: string | number;
  paid: boolean;
}

interface DashboardData {
  date: string;
  customers: DashboardCustomer[];
  totalExpected: string | number;
  totalReceived: string | number;
  remaining: string | number;
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

export default function AgentCollectionDashboardPage() {
  const queryClient = useQueryClient();
  const [date] = useState(todayStr);

  // Collection form state
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [formAmount, setFormAmount] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('cash');
  const [formError, setFormError] = useState('');

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['agent-dashboard', date],
    queryFn: () => api.get<DashboardData>(`/api/agent-collections/dashboard?date=${date}`),
  });

  const recordMutation = useMutation({
    mutationFn: (body: { customerId: string; amount: number; paymentMethod: string; paymentDate: string }) =>
      api.post('/api/agent-collections', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-dashboard'] });
      setActiveCustomerId(null);
      setFormAmount('');
      setFormPaymentMethod('cash');
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to record payment');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCustomerId) return;
    setFormError('');
    const amount = parseFloat(formAmount);
    if (!formAmount || isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid positive amount');
      return;
    }
    recordMutation.mutate({
      customerId: activeCustomerId,
      amount,
      paymentMethod: formPaymentMethod,
      paymentDate: date,
    });
  }

  function openForm(customerId: string) {
    setActiveCustomerId(customerId);
    setFormAmount('');
    setFormPaymentMethod('cash');
    setFormError('');
  }

  function closeForm() {
    setActiveCustomerId(null);
    setFormAmount('');
    setFormPaymentMethod('cash');
    setFormError('');
  }

  const customers = dashboard?.customers ?? [];

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">My Collections</h1>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Expected</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {dashboard ? currency(dashboard.totalExpected) : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Received</p>
          <p className="mt-1 text-2xl font-semibold text-green-700">
            {dashboard ? currency(dashboard.totalReceived) : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Remaining</p>
          <p className="mt-1 text-2xl font-semibold text-red-600">
            {dashboard ? currency(dashboard.remaining) : '—'}
          </p>
        </div>
      </div>

      {/* Assigned customers list */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {customers.map((c) => (
              <tr key={c.customer.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{c.customer.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.customer.phone || '—'}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">{currency(c.balance)}</td>
                <td className="px-4 py-3 text-sm text-center">
                  {c.paid ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-center">
                  <button
                    type="button"
                    onClick={() => openForm(c.customer.id)}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Record Payment
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  No customers assigned
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Collection form modal */}
      {activeCustomerId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Record payment"
        >
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Record Payment — {customers.find((c) => c.customer.id === activeCustomerId)?.customer.name}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-3">
                <div>
                  <label htmlFor="collect-amount" className="block text-xs text-gray-500 mb-1">Amount (₹)</label>
                  <input
                    id="collect-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="collect-method" className="block text-xs text-gray-500 mb-1">Payment Method</label>
                  <select
                    id="collect-method"
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {formError && <p className="mt-2 text-sm text-red-600" role="alert">{formError}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordMutation.isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {recordMutation.isPending ? 'Recording…' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
