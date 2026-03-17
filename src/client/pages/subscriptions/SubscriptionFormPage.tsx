import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/lib/api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CustomerOption { id: string; name: string; phone: string; }
interface VariantOption { id: string; product: { id: string; name: string }; unitType: string; quantityPerUnit: number; }

export default function SubscriptionFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ customerId: '', productVariantId: '', quantity: '', frequencyType: 'daily', weekdays: [] as number[], startDate: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existing } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => api.get<{ data: { customerId: string; productVariantId: string; quantity: number; frequencyType: string; weekdays: number[]; startDate: string } }>(`/api/v1/subscriptions/${id}`),
    enabled: isEdit,
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-options'],
    queryFn: () => api.get<{ data: CustomerOption[] }>('/api/v1/customers?limit=500&status=active'),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => api.get<{ data: Array<{ id: string; name: string; variants: VariantOption[] }> }>('/api/v1/products?limit=200'),
  });

  useEffect(() => {
    if (existing?.data) {
      const s = existing.data;
      setForm({ customerId: s.customerId, productVariantId: s.productVariantId, quantity: String(s.quantity), frequencyType: s.frequencyType, weekdays: s.weekdays ?? [], startDate: s.startDate });
    }
  }, [existing]);

  // Build flat variant options from products
  const variantOptions: Array<{ id: string; label: string }> = [];
  productsData?.data?.forEach((p) => {
    p.variants?.forEach((v) => {
      variantOptions.push({ id: v.id, label: `${p.name} - ${v.quantityPerUnit} ${v.unitType}` });
    });
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEdit ? api.put(`/api/v1/subscriptions/${id}`, data) : api.post('/api/v1/subscriptions', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscriptions'] }); navigate('/subscriptions'); },
    onError: (err: ApiError) => {
      if (err.errors) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      else setErrors({ _form: err.message });
    },
  });

  function toggleWeekday(day: number) {
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day) ? prev.weekdays.filter((d) => d !== day) : [...prev.weekdays, day],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const payload: Record<string, unknown> = { quantity: Number(form.quantity), frequencyType: form.frequencyType };
    if (!isEdit) {
      payload.customerId = form.customerId;
      payload.productVariantId = form.productVariantId;
      payload.startDate = form.startDate;
    }
    if (form.frequencyType === 'custom_weekday') payload.weekdays = form.weekdays;
    mutation.mutate(payload);
  }

  const fieldClass = (name: string) =>
    `w-full rounded-md border ${errors[name] ? 'border-red-500' : 'border-gray-300'} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">{isEdit ? 'Edit Subscription' : 'New Subscription'}</h1>

      {errors._form && <div role="alert" className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{errors._form}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        {!isEdit && (
          <>
            <div>
              <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select id="customerId" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className={fieldClass('customerId')} required>
                <option value="">Select customer</option>
                {customersData?.data?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
              </select>
              {errors.customerId && <p className="text-xs text-red-600 mt-1">{errors.customerId}</p>}
            </div>
            <div>
              <label htmlFor="productVariantId" className="block text-sm font-medium text-gray-700 mb-1">Product Variant *</label>
              <select id="productVariantId" value={form.productVariantId} onChange={(e) => setForm({ ...form, productVariantId: e.target.value })} className={fieldClass('productVariantId')} required>
                <option value="">Select variant</option>
                {variantOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              {errors.productVariantId && <p className="text-xs text-red-600 mt-1">{errors.productVariantId}</p>}
            </div>
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={fieldClass('startDate')} required />
              {errors.startDate && <p className="text-xs text-red-600 mt-1">{errors.startDate}</p>}
            </div>
          </>
        )}

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
          <input id="quantity" type="number" step="0.001" min="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={fieldClass('quantity')} required />
          {errors.quantity && <p className="text-xs text-red-600 mt-1">{errors.quantity}</p>}
        </div>

        <div>
          <label htmlFor="frequencyType" className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
          <select id="frequencyType" value={form.frequencyType} onChange={(e) => setForm({ ...form, frequencyType: e.target.value })} className={fieldClass('frequencyType')}>
            <option value="daily">Daily</option>
            <option value="alternate_day">Alternate Day</option>
            <option value="custom_weekday">Custom Weekday</option>
          </select>
        </div>

        {form.frequencyType === 'custom_weekday' && (
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">Select Weekdays</legend>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAYS.map((label, i) => (
                <button key={i} type="button" onClick={() => toggleWeekday(i)}
                  className={`rounded-md px-3 py-1.5 text-sm border ${form.weekdays.includes(i) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  aria-pressed={form.weekdays.includes(i)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate('/subscriptions')} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
