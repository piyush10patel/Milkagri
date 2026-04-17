import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

interface ProductVariant {
  id: string;
  unitType: string;
  quantityPerUnit: number;
  product: { id: string; name: string };
}

export default function PaymentFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preCustomerId = searchParams.get('customerId') ?? '';
  const preInvoiceId = searchParams.get('invoiceId') ?? '';
  const preOverspill = searchParams.get('overspill') === 'true';

  const [form, setForm] = useState({
    customerId: preCustomerId,
    invoiceId: preInvoiceId,
    amount: '',
    paymentMethod: 'cash',
    paymentMethodDescription: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    isOverspill: preOverspill,
    overspillQuantity: '',
    overspillProductId: '',
    overspillNotes: '',
  });
  const [error, setError] = useState('');

  const { data: customers } = useQuery({
    queryKey: ['customers-select'],
    queryFn: () => api.get<{ data: Array<{ id: string; name: string }> }>('/api/v1/customers?limit=200&status=active'),
  });

  const { data: invoices } = useQuery({
    queryKey: ['customer-invoices', form.customerId],
    queryFn: () => api.get<{ data: Array<{ id: string; billingCycleStart: string; billingCycleEnd: string; closingBalance: number; paymentStatus: string }> }>(
      `/api/v1/billing/invoices?customerId=${form.customerId}&limit=50`
    ),
    enabled: !!form.customerId && !form.isOverspill,
  });

  const { data: variants } = useQuery({
    queryKey: ['product-variants-select'],
    queryFn: () => api.get<{ data: Array<{ id: string; variants: ProductVariant[] }> }>('/api/v1/products?limit=100&isActive=true'),
    enabled: form.isOverspill,
  });

  const allVariants: ProductVariant[] = (variants?.data ?? []).flatMap((p: any) =>
    (p.variants ?? []).filter((v: any) => v.isActive !== false).map((v: any) => ({
      ...v,
      product: { id: p.id, name: p.name },
    }))
  );

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/api/v1/payments', data),
    onSuccess: () => navigate('/payments'),
    onError: (err: { message?: string }) => setError(err.message ?? 'Failed to record payment'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const payload: Record<string, unknown> = {
      customerId: form.customerId,
      amount: Number(form.amount),
      paymentMethod: form.paymentMethod,
      paymentMethodDescription: form.paymentMethod === 'other' ? form.paymentMethodDescription : undefined,
      paymentDate: form.paymentDate,
    };

    if (form.isOverspill) {
      payload.isOverspill = true;
      if (form.overspillQuantity) payload.overspillQuantity = Number(form.overspillQuantity);
      if (form.overspillProductId) payload.overspillProductId = form.overspillProductId;
      if (form.overspillNotes) payload.overspillNotes = form.overspillNotes;
    } else {
      payload.invoiceId = form.invoiceId || undefined;
    }

    mutation.mutate(payload);
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Record Payment</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        {/* Payment type toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, isOverspill: false, invoiceId: '' })}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${!form.isOverspill ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Regular Payment
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, isOverspill: true, invoiceId: '' })}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${form.isOverspill ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Overspill Payment
          </button>
        </div>

        {form.isOverspill && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Overspill: extra milk collected outside the regular billing cycle. Enter quantity and amount.
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
          <select
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value, invoiceId: '' })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            aria-label="Select customer"
          >
            <option value="">Select customer…</option>
            {customers?.data?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {!form.isOverspill && form.customerId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice (optional)</label>
            <select
              value={form.invoiceId}
              onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select invoice"
            >
              <option value="">Advance payment (no invoice)</option>
              {invoices?.data?.filter((i) => i.paymentStatus !== 'paid').map((i) => (
                <option key={i.id} value={i.id}>
                  {i.billingCycleStart} — {i.billingCycleEnd} (Balance: ₹{Number(i.closingBalance).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        )}

        {form.isOverspill && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Variant (optional)</label>
              <select
                value={form.overspillProductId}
                onChange={(e) => setForm({ ...form, overspillProductId: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Select product variant"
              >
                <option value="">No specific product</option>
                {allVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.product.name} — {v.quantityPerUnit} {v.unitType}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Overspill Quantity</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={form.overspillQuantity}
                onChange={(e) => setForm({ ...form, overspillQuantity: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 2.5"
                aria-label="Overspill quantity"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.overspillNotes}
                onChange={(e) => setForm({ ...form, overspillNotes: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={2}
                placeholder="Optional note about the overspill"
                aria-label="Overspill notes"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            aria-label="Payment amount"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
          <select
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Payment method"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {form.paymentMethod === 'other' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={form.paymentMethodDescription}
              onChange={(e) => setForm({ ...form, paymentMethodDescription: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              required
              aria-label="Payment method description"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
          <input
            type="date"
            value={form.paymentDate}
            onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            aria-label="Payment date"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Recording…' : form.isOverspill ? 'Record Overspill' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
