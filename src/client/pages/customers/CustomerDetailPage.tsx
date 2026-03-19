import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';


interface Address { id: string; addressLine1: string; addressLine2?: string; city?: string; state?: string; pincode?: string; isPrimary: boolean; }
interface Subscription {
  id: string;
  route?: { id: string; name: string } | null;
  productVariant: { product: { name: string }; unitType: string; quantityPerUnit: number };
  quantity: number;
  deliverySession: 'morning' | 'evening';
  packs?: Array<{ packSize: number | string; packCount: number }>;
  frequencyType: string;
  status: string;
  startDate: string;
}
interface LedgerEntry { id: string; entryDate: string; transactionType: string; debitAmount: number; creditAmount: number; runningBalance: number; description?: string; }
interface CustomerDetail {
  id: string; name: string; phone: string; email?: string; status: string;
  deliveryNotes?: string; preferredDeliveryWindow?: string;
  pricingCategory?: string; billingFrequency?: string;
  route?: { id: string; name: string };
  addresses: Address[];
  createdAt: string;
}
interface PricingCategoryOption { id: string; code: string; name: string; }

export default function CustomerDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const closeConfirm = useCallback(() => setConfirmAction(null), []);
  const { modalRef: confirmModalRef } = useModalFocusTrap(!!confirmAction, closeConfirm);

  const { data: customerData, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<{ data: CustomerDetail }>(`/api/v1/customers/${id}`),
  });

  const { data: subsData } = useQuery({
    queryKey: ['customer-subscriptions', id],
    queryFn: () => api.get<{ data: Subscription[] }>(`/api/v1/subscriptions?customerId=${id}&limit=50`),
  });

  const { data: ledgerData } = useQuery({
    queryKey: ['customer-ledger', id],
    queryFn: () => api.get<{ data: LedgerEntry[] }>(`/api/v1/customers/${id}/ledger?limit=20`),
  });

  const { data: pricingCategoriesData } = useQuery({
    queryKey: ['pricing-categories-options'],
    queryFn: () => api.get<{ data: PricingCategoryOption[] }>('/api/v1/pricing-categories'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/api/v1/customers/${id}/status`, { status }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customer', id] }); setConfirmAction(null); },
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  const c = customerData?.data;
  if (!c) return <p className="text-sm text-red-600">Customer not found</p>;

  const statusColors: Record<string, string> = { active: 'bg-green-100 text-green-800', paused: 'bg-yellow-100 text-yellow-800', stopped: 'bg-red-100 text-red-800' };
  const freqLabel: Record<string, string> = { daily: 'Daily', alternate_day: 'Alternate Day', custom_weekday: 'Custom Weekday' };
  const billingFrequencyLabel: Record<string, string> = { daily: 'Daily', every_2_days: 'Every 2 Days', weekly: 'Weekly', every_10_days: 'Every 10 Days', monthly: 'Monthly' };
  const pricingCategoryLabel = pricingCategoriesData?.data?.find((item) => item.code === c.pricingCategory)?.name ?? c.pricingCategory;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <Link to="/customers" className="text-sm text-blue-600 hover:underline">← Customers</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">{c.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link to={`/customers/${c.id}/edit`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Edit</Link>
          {c.status === 'active' && (
            <>
              <button onClick={() => setConfirmAction('paused')} className="rounded-md border border-yellow-300 px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-50">Pause</button>
              <button onClick={() => setConfirmAction('stopped')} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">Stop</button>
            </>
          )}
          {(c.status === 'paused' || c.status === 'stopped') && (
            <button onClick={() => setConfirmAction('active')} className="rounded-md border border-green-300 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50">Reactivate</button>
          )}
        </div>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><p className="text-xs text-gray-500">Phone</p><p className="text-sm">{c.phone}</p></div>
          <div><p className="text-xs text-gray-500">Email</p><p className="text-sm">{c.email || '—'}</p></div>
          <div><p className="text-xs text-gray-500">Status</p><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[c.status] ?? ''}`}>{c.status}</span></div>
          <div><p className="text-xs text-gray-500">Route</p><p className="text-sm">{c.route?.name ?? '—'}</p></div>
          <div><p className="text-xs text-gray-500">Delivery Notes</p><p className="text-sm">{c.deliveryNotes || '—'}</p></div>
          <div><p className="text-xs text-gray-500">Preferred Window</p><p className="text-sm">{c.preferredDeliveryWindow || '—'}</p></div>
          <div><p className="text-xs text-gray-500">Pricing Category</p><p className="text-sm">{c.pricingCategory ? pricingCategoryLabel : '—'}</p></div>
          <div><p className="text-xs text-gray-500">Billing Frequency</p><p className="text-sm">{c.billingFrequency ? billingFrequencyLabel[c.billingFrequency] ?? c.billingFrequency : '—'}</p></div>
        </div>
      </div>

      {/* Addresses */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Addresses</h2>
        {c.addresses?.length ? (
          <div className="space-y-2">
            {c.addresses.map((a) => (
              <div key={a.id} className="border border-gray-100 rounded p-3 text-sm">
                {a.isPrimary && <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 mr-2">Primary</span>}
                {[a.addressLine1, a.addressLine2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">No addresses</p>}
      </div>

      {/* Subscriptions */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Subscriptions</h2>
        {subsData?.data?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead><tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Session</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Route</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Frequency</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Start</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {subsData.data.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">{s.productVariant?.product?.name} ({s.productVariant?.quantityPerUnit} {s.productVariant?.unitType})</td>
                    <td className="px-3 py-2">
                      <div>{s.quantity}</div>
                      <div className="text-xs text-gray-500">
                        {s.packs?.length ? s.packs.map((pack) => `${pack.packCount} x ${Number(pack.packSize)}L`).join(', ') : 'No packs'}
                      </div>
                    </td>
                    <td className="px-3 py-2 capitalize">{s.deliverySession}</td>
                    <td className="px-3 py-2">{s.route?.name ?? '—'}</td>
                    <td className="px-3 py-2">{freqLabel[s.frequencyType] ?? s.frequencyType}</td>
                    <td className="px-3 py-2">{s.status}</td>
                    <td className="px-3 py-2">{s.startDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-500">No subscriptions</p>}
      </div>

      {/* Ledger Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Ledger (Recent)</h2>
          <a href={`/api/v1/customers/${id}/ledger/pdf`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Download PDF</a>
        </div>
        {ledgerData?.data?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead><tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500">Debit</th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500">Credit</th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500">Balance</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {ledgerData.data.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2">{e.entryDate}</td>
                    <td className="px-3 py-2">{e.transactionType}</td>
                    <td className="px-3 py-2 text-right">{e.debitAmount > 0 ? `₹${e.debitAmount.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 text-right">{e.creditAmount > 0 ? `₹${e.creditAmount.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">₹{e.runningBalance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-500">No ledger entries</p>}
      </div>

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="confirm-detail-title">
          <div ref={confirmModalRef} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="confirm-detail-title" className="text-lg font-semibold text-gray-900 mb-2">Confirm Status Change</h2>
            <p className="text-sm text-gray-600 mb-4">Change status to <span className="font-medium">{confirmAction}</span>?</p>
            <div className="flex justify-end gap-2">
              <button onClick={closeConfirm} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={() => statusMutation.mutate(confirmAction)} disabled={statusMutation.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                {statusMutation.isPending ? 'Updating…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
