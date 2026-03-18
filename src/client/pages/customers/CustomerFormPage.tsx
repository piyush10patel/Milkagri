import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/lib/api';

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  deliveryNotes?: string;
  preferredDeliveryWindow?: string;
  routeId?: string;
  pricingCategory?: string;
  billingFrequency?: string;
}

interface RouteOption { id: string; name: string; }

export default function CustomerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ name: '', phone: '', email: '', deliveryNotes: '', preferredDeliveryWindow: '', routeId: '', pricingCategory: 'cat_1', billingFrequency: 'monthly' });
  const [address, setAddress] = useState({ addressLine1: '', addressLine2: '', city: '', state: '', pincode: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existing } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<{ data: CustomerData }>(`/api/v1/customers/${id}`),
    enabled: isEdit,
  });

  const { data: routesData } = useQuery({
    queryKey: ['routes-options'],
    queryFn: () => api.get<{ data: RouteOption[] }>('/api/v1/routes?limit=200'),
  });

  useEffect(() => {
    if (existing?.data) {
      const c = existing.data;
      setForm({ name: c.name, phone: c.phone, email: c.email ?? '', deliveryNotes: c.deliveryNotes ?? '', preferredDeliveryWindow: c.preferredDeliveryWindow ?? '', routeId: c.routeId ?? '', pricingCategory: c.pricingCategory ?? 'cat_1', billingFrequency: c.billingFrequency ?? 'monthly' });
    }
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEdit ? api.put(`/api/v1/customers/${id}`, data) : api.post('/api/v1/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/customers');
    },
    onError: (err: ApiError) => {
      if (err.errors) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      else setErrors({ _form: err.message });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const payload: Record<string, unknown> = { name: form.name, phone: form.phone };
    if (form.email) payload.email = form.email;
    if (form.deliveryNotes) payload.deliveryNotes = form.deliveryNotes;
    if (form.preferredDeliveryWindow) payload.preferredDeliveryWindow = form.preferredDeliveryWindow;
    if (form.routeId) payload.routeId = form.routeId;
    payload.pricingCategory = form.pricingCategory;
    payload.billingFrequency = form.billingFrequency;
    if (!isEdit && address.addressLine1) {
      payload.address = { addressLine1: address.addressLine1, addressLine2: address.addressLine2 || undefined, city: address.city || undefined, state: address.state || undefined, pincode: address.pincode || undefined, isPrimary: true };
    }
    mutation.mutate(payload);
  }

  const fieldClass = (name: string) =>
    `w-full rounded-md border ${errors[name] ? 'border-red-500' : 'border-gray-300'} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">{isEdit ? 'Edit Customer' : 'New Customer'}</h1>

      {errors._form && <div role="alert" className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{errors._form}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass('name')} required />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
          <input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass('phone')} required />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass('email')} />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="routeId" className="block text-sm font-medium text-gray-700 mb-1">Route</label>
          <select id="routeId" value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} className={fieldClass('routeId')}>
            <option value="">No route</option>
            {routesData?.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="pricingCategory" className="block text-sm font-medium text-gray-700 mb-1">Pricing Category</label>
          <select id="pricingCategory" value={form.pricingCategory} onChange={(e) => setForm({ ...form, pricingCategory: e.target.value })} className={fieldClass('pricingCategory')}>
            <option value="cat_1">Cat 1</option>
            <option value="cat_2">Cat 2</option>
            <option value="cat_3">Cat 3</option>
          </select>
          {errors.pricingCategory && <p className="text-xs text-red-600 mt-1">{errors.pricingCategory}</p>}
        </div>

        <div>
          <label htmlFor="billingFrequency" className="block text-sm font-medium text-gray-700 mb-1">Billing Frequency</label>
          <select id="billingFrequency" value={form.billingFrequency} onChange={(e) => setForm({ ...form, billingFrequency: e.target.value })} className={fieldClass('billingFrequency')}>
            <option value="daily">Daily</option>
            <option value="every_2_days">Every 2 Days</option>
            <option value="weekly">Weekly</option>
            <option value="every_10_days">Every 10 Days</option>
            <option value="monthly">Monthly</option>
          </select>
          {errors.billingFrequency && <p className="text-xs text-red-600 mt-1">{errors.billingFrequency}</p>}
        </div>

        <div>
          <label htmlFor="deliveryNotes" className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes</label>
          <textarea id="deliveryNotes" value={form.deliveryNotes} onChange={(e) => setForm({ ...form, deliveryNotes: e.target.value })} className={fieldClass('deliveryNotes')} rows={2} />
        </div>

        <div>
          <label htmlFor="preferredDeliveryWindow" className="block text-sm font-medium text-gray-700 mb-1">Preferred Delivery Window</label>
          <input id="preferredDeliveryWindow" value={form.preferredDeliveryWindow} onChange={(e) => setForm({ ...form, preferredDeliveryWindow: e.target.value })} className={fieldClass('preferredDeliveryWindow')} placeholder="e.g. 6:00 AM - 8:00 AM" />
        </div>

        {!isEdit && (
          <fieldset className="border border-gray-200 rounded-md p-4">
            <legend className="text-sm font-medium text-gray-700 px-1">Primary Address</legend>
            <div className="space-y-3 mt-2">
              <div>
                <label htmlFor="addressLine1" className="block text-sm text-gray-600 mb-1">Address Line 1</label>
                <input id="addressLine1" value={address.addressLine1} onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })} className={fieldClass('addressLine1')} />
              </div>
              <div>
                <label htmlFor="addressLine2" className="block text-sm text-gray-600 mb-1">Address Line 2</label>
                <input id="addressLine2" value={address.addressLine2} onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })} className={fieldClass('addressLine2')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="city" className="block text-sm text-gray-600 mb-1">City</label>
                  <input id="city" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className={fieldClass('city')} />
                </div>
                <div>
                  <label htmlFor="state" className="block text-sm text-gray-600 mb-1">State</label>
                  <input id="state" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className={fieldClass('state')} />
                </div>
                <div>
                  <label htmlFor="pincode" className="block text-sm text-gray-600 mb-1">Pincode</label>
                  <input id="pincode" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} className={fieldClass('pincode')} />
                </div>
              </div>
            </div>
          </fieldset>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate('/customers')} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
