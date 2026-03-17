import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

interface LineItem {
  id: string;
  deliveryDate: string;
  productVariant: { product: { name: string }; unitType: string; quantityPerUnit: number };
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface Adjustment {
  id: string;
  adjustmentType: 'credit' | 'debit';
  amount: number;
  reason: string;
  createdAt: string;
}

interface Discount {
  id: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  amount: number;
  description?: string;
  createdAt: string;
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
}

interface InvoiceDetail {
  id: string;
  customer: { id: string; name: string; phone: string };
  billingCycleStart: string;
  billingCycleEnd: string;
  version: number;
  openingBalance: number;
  totalCharges: number;
  totalDiscounts: number;
  totalAdjustments: number;
  totalPayments: number;
  closingBalance: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  lineItems: LineItem[];
  adjustments: Adjustment[];
  discounts: Discount[];
  payments: Payment[];
}

const STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-800',
  partial: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAdjustment, setShowAdjustment] = useState(false);
  const closeAdjModal = useCallback(() => { setShowAdjustment(false); setAdjForm({ adjustmentType: 'credit', amount: '', reason: '' }); }, []);
  const { modalRef: adjModalRef } = useModalFocusTrap(showAdjustment, closeAdjModal);
  const [showDiscount, setShowDiscount] = useState(false);
  const closeDiscModal = useCallback(() => { setShowDiscount(false); setDiscForm({ discountType: 'fixed', value: '', description: '' }); }, []);
  const { modalRef: discModalRef } = useModalFocusTrap(showDiscount, closeDiscModal);
  const [adjForm, setAdjForm] = useState({ adjustmentType: 'credit', amount: '', reason: '' });
  const [discForm, setDiscForm] = useState({ discountType: 'fixed', value: '', description: '' });

  const { data: invoiceData, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<{ data: InvoiceDetail }>(`/api/v1/billing/invoices/${id}`),
  });

  const adjustmentMutation = useMutation({
    mutationFn: (data: { adjustmentType: string; amount: number; reason: string }) =>
      api.post(`/api/v1/billing/invoices/${id}/adjustments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      setShowAdjustment(false);
      setAdjForm({ adjustmentType: 'credit', amount: '', reason: '' });
    },
  });

  const discountMutation = useMutation({
    mutationFn: (data: { discountType: string; value: number; description?: string }) =>
      api.post(`/api/v1/billing/invoices/${id}/discounts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      setShowDiscount(false);
      setDiscForm({ discountType: 'fixed', value: '', description: '' });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/billing/invoices/${id}/regenerate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoice', id] }),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  const inv = invoiceData?.data;
  if (!inv) return <p className="text-sm text-red-600">Invoice not found</p>;

  const isBillingStaff = user?.role === 'billing_staff' || user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <Link to="/billing" className="text-sm text-blue-600 hover:underline print:hidden">← Invoices</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Invoice — {inv.customer.name}</h1>
        </div>
        <div className="flex gap-2 print:hidden">
          <a
            href={`/api/v1/billing/invoices/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
            aria-label="Download invoice PDF"
          >
            📄 Download PDF
          </a>
          {isBillingStaff && (
            <button
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              aria-label="Regenerate invoice"
            >
              {regenerateMutation.isPending ? 'Regenerating…' : '🔄 Regenerate'}
            </button>
          )}
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><p className="text-xs text-gray-500">Billing Period</p><p className="text-sm">{inv.billingCycleStart} — {inv.billingCycleEnd}</p></div>
          <div><p className="text-xs text-gray-500">Version</p><p className="text-sm">{inv.version}</p></div>
          <div><p className="text-xs text-gray-500">Status</p><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.paymentStatus] ?? ''}`}>{inv.paymentStatus}</span></div>
          <div><p className="text-xs text-gray-500">Customer</p><Link to={`/customers/${inv.customer.id}`} className="text-sm text-blue-600 hover:underline">{inv.customer.name}</Link></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div><p className="text-xs text-gray-500">Opening Balance</p><p className="text-sm font-medium">₹{Number(inv.openingBalance).toFixed(2)}</p></div>
          <div><p className="text-xs text-gray-500">Charges</p><p className="text-sm font-medium">₹{Number(inv.totalCharges).toFixed(2)}</p></div>
          <div><p className="text-xs text-gray-500">Discounts</p><p className="text-sm font-medium text-green-700">-₹{Number(inv.totalDiscounts).toFixed(2)}</p></div>
          <div><p className="text-xs text-gray-500">Adjustments</p><p className="text-sm font-medium">₹{Number(inv.totalAdjustments).toFixed(2)}</p></div>
          <div><p className="text-xs text-gray-500">Payments</p><p className="text-sm font-medium text-green-700">-₹{Number(inv.totalPayments).toFixed(2)}</p></div>
          <div><p className="text-xs text-gray-500">Closing Balance</p><p className="text-lg font-bold">₹{Number(inv.closingBalance).toFixed(2)}</p></div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Line Items</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead><tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {inv.lineItems?.map((li) => (
                <tr key={li.id}>
                  <td className="px-3 py-2">{li.deliveryDate}</td>
                  <td className="px-3 py-2">{li.productVariant?.product?.name} ({li.productVariant?.quantityPerUnit} {li.productVariant?.unitType})</td>
                  <td className="px-3 py-2 text-right">{li.quantity}</td>
                  <td className="px-3 py-2 text-right">₹{Number(li.unitPrice).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-medium">₹{Number(li.lineTotal).toFixed(2)}</td>
                </tr>
              ))}
              {(!inv.lineItems || inv.lineItems.length === 0) && (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustments */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Adjustments</h2>
          {isBillingStaff && (
            <button onClick={() => setShowAdjustment(true)} className="text-xs text-blue-600 hover:underline print:hidden" aria-label="Add adjustment">+ Add</button>
          )}
        </div>
        {inv.adjustments?.length ? (
          <div className="space-y-2">
            {inv.adjustments.map((a) => (
              <div key={a.id} className="flex items-center justify-between border border-gray-100 rounded p-2 text-sm">
                <div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mr-2 ${a.adjustmentType === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{a.adjustmentType}</span>
                  <span className="text-gray-600">{a.reason}</span>
                </div>
                <span className="font-medium">₹{Number(a.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">No adjustments</p>}
      </div>

      {/* Discounts */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Discounts</h2>
          {isBillingStaff && (
            <button onClick={() => setShowDiscount(true)} className="text-xs text-blue-600 hover:underline print:hidden" aria-label="Add discount">+ Add</button>
          )}
        </div>
        {inv.discounts?.length ? (
          <div className="space-y-2">
            {inv.discounts.map((d) => (
              <div key={d.id} className="flex items-center justify-between border border-gray-100 rounded p-2 text-sm">
                <div>
                  <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 mr-2">{d.discountType === 'percentage' ? `${d.value}%` : 'Fixed'}</span>
                  <span className="text-gray-600">{d.description || '—'}</span>
                </div>
                <span className="font-medium text-green-700">-₹{Number(d.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">No discounts</p>}
      </div>

      {/* Payments */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Payments</h2>
          <Link to={`/payments/new?customerId=${inv.customer.id}&invoiceId=${inv.id}`} className="text-xs text-blue-600 hover:underline print:hidden">+ Record Payment</Link>
        </div>
        {inv.payments?.length ? (
          <div className="space-y-2">
            {inv.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border border-gray-100 rounded p-2 text-sm">
                <div>
                  <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5 mr-2">{p.paymentMethod}</span>
                  <span className="text-gray-600">{p.paymentDate}</span>
                </div>
                <span className="font-medium text-green-700">₹{Number(p.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">No payments recorded</p>}
      </div>

      {/* Add Adjustment Modal */}
      {showAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="adj-title">
          <div ref={adjModalRef} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="adj-title" className="text-lg font-semibold text-gray-900 mb-3">Add Adjustment</h2>
            <form onSubmit={(e) => { e.preventDefault(); adjustmentMutation.mutate({ adjustmentType: adjForm.adjustmentType, amount: Number(adjForm.amount), reason: adjForm.reason }); }} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Type</label>
                <select value={adjForm.adjustmentType} onChange={(e) => setAdjForm({ ...adjForm, adjustmentType: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" aria-label="Adjustment type">
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" min="0.01" value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required aria-label="Adjustment amount" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Reason</label>
                <textarea value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required aria-label="Adjustment reason" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeAdjModal} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
                <button type="submit" disabled={adjustmentMutation.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                  {adjustmentMutation.isPending ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Discount Modal */}
      {showDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="disc-title">
          <div ref={discModalRef} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="disc-title" className="text-lg font-semibold text-gray-900 mb-3">Add Discount</h2>
            <form onSubmit={(e) => { e.preventDefault(); discountMutation.mutate({ discountType: discForm.discountType, value: Number(discForm.value), description: discForm.description || undefined }); }} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Type</label>
                <select value={discForm.discountType} onChange={(e) => setDiscForm({ ...discForm, discountType: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" aria-label="Discount type">
                  <option value="fixed">Fixed Amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">{discForm.discountType === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}</label>
                <input type="number" step="0.01" min="0.01" value={discForm.value} onChange={(e) => setDiscForm({ ...discForm, value: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required aria-label="Discount value" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Description (optional)</label>
                <input type="text" value={discForm.description} onChange={(e) => setDiscForm({ ...discForm, description: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" aria-label="Discount description" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeDiscModal} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
                <button type="submit" disabled={discountMutation.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                  {discountMutation.isPending ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
