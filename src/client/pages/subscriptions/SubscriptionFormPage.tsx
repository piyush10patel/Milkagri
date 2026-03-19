import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/lib/api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DELIVERY_SESSIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
] as const;

interface CustomerOption { id: string; name: string; phone: string; pricingCategory?: string; }
interface RouteOption { id: string; name: string; }
interface VariantOption { id: string; product: { id: string; name: string }; unitType: string; quantityPerUnit: number; }
interface PricingCategoryOption { id: string; code: string; name: string; }
interface PricingRow {
  id: string;
  latestPrices: {
    default: { price: number; effectiveDate: string } | null;
    categories: Record<string, { price: number; effectiveDate: string } | null>;
  };
}
interface PackRow {
  packSize: string;
  packCount: string;
}
interface SubscriptionDetail {
  customerId: string;
  productVariantId: string;
  routeId?: string | null;
  quantity: number;
  deliverySession: 'morning' | 'evening';
  frequencyType: string;
  weekdays: number[];
  startDate: string;
  packs?: Array<{ packSize: number | string; packCount: number }>;
}

function createEmptyPackRow(): PackRow {
  return { packSize: '', packCount: '' };
}

function formatPackSummary(packs: Array<{ packSize: string; packCount: string }>) {
  return packs
    .filter((pack) => pack.packSize && pack.packCount)
    .map((pack) => `${pack.packCount} x ${pack.packSize}L`)
    .join(', ');
}

export default function SubscriptionFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    customerId: '',
    productVariantId: '',
    routeId: '',
    quantity: '',
    deliverySession: 'morning',
    frequencyType: 'daily',
    weekdays: [] as number[],
    startDate: '',
  });
  const [packRows, setPackRows] = useState<PackRow[]>([createEmptyPackRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existing } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => api.get<SubscriptionDetail>(`/api/v1/subscriptions/${id}`),
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

  const { data: routesData } = useQuery({
    queryKey: ['routes-options'],
    queryFn: () => api.get<{ data: RouteOption[] }>('/api/v1/routes?limit=200&isActive=true'),
  });

  const { data: pricingData } = useQuery({
    queryKey: ['pricing-matrix'],
    queryFn: () => api.get<{ data: { categories: PricingCategoryOption[]; rows: PricingRow[] } }>('/api/v1/products/pricing-matrix'),
  });

  const { data: pricingCategoriesData } = useQuery({
    queryKey: ['pricing-categories-options'],
    queryFn: () => api.get<{ data: PricingCategoryOption[] }>('/api/v1/pricing-categories'),
  });

  useEffect(() => {
    if (existing) {
      setForm({
        customerId: existing.customerId,
        productVariantId: existing.productVariantId,
        routeId: existing.routeId ?? '',
        quantity: String(existing.quantity),
        deliverySession: existing.deliverySession ?? 'morning',
        frequencyType: existing.frequencyType,
        weekdays: existing.weekdays ?? [],
        startDate: existing.startDate,
      });
      setPackRows(
        existing.packs?.length
          ? existing.packs.map((pack) => ({
              packSize: String(pack.packSize),
              packCount: String(pack.packCount),
            }))
          : [createEmptyPackRow()],
      );
    }
  }, [existing]);

  // Build flat variant options from products
  const variantOptions: Array<{ id: string; label: string }> = [];
  productsData?.data?.forEach((p) => {
    p.variants?.forEach((v) => {
      variantOptions.push({ id: v.id, label: `${p.name} - ${v.quantityPerUnit} ${v.unitType}` });
    });
  });

  const selectedCustomer = customersData?.data?.find((customer) => customer.id === form.customerId);
  const selectedPricing = pricingData?.data?.rows?.find((variant) => variant.id === form.productVariantId);
  const appliedCategory = selectedCustomer?.pricingCategory ?? pricingCategoriesData?.data?.[0]?.code ?? '';
  const appliedPrice =
    (appliedCategory ? selectedPricing?.latestPrices?.categories?.[appliedCategory] : null) ??
    selectedPricing?.latestPrices?.default ??
    null;
  const appliedCategoryName = pricingCategoriesData?.data?.find((category) => category.code === appliedCategory)?.name ?? appliedCategory;

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
    const payload: Record<string, unknown> = {
      quantity: Number(form.quantity),
      routeId: form.routeId || null,
      deliverySession: form.deliverySession,
      frequencyType: form.frequencyType,
      packBreakdown: packRows
        .filter((pack) => pack.packSize && pack.packCount)
        .map((pack) => ({
          packSize: Number(pack.packSize),
          packCount: Number(pack.packCount),
        })),
    };
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

  const packTotal = packRows.reduce((sum, pack) => {
    const packSize = Number(pack.packSize);
    const packCount = Number(pack.packCount);
    if (!pack.packSize || !pack.packCount || Number.isNaN(packSize) || Number.isNaN(packCount)) {
      return sum;
    }
    return sum + packSize * packCount;
  }, 0);
  const quantityValue = Number(form.quantity);
  const hasPackRows = packRows.some((pack) => pack.packSize || pack.packCount);
  const packMismatch = hasPackRows && !Number.isNaN(quantityValue) && Math.abs(packTotal - quantityValue) > 0.001;

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
              <label htmlFor="productVariantId" className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
              <select id="productVariantId" value={form.productVariantId} onChange={(e) => setForm({ ...form, productVariantId: e.target.value })} className={fieldClass('productVariantId')} required>
                <option value="">Select product</option>
                {variantOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              {errors.productVariantId && <p className="text-xs text-red-600 mt-1">{errors.productVariantId}</p>}
            </div>
            <div>
              <label htmlFor="routeId" className="block text-sm font-medium text-gray-700 mb-1">Route *</label>
              <select id="routeId" value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} className={fieldClass('routeId')} required>
                <option value="">Select route</option>
                {routesData?.data?.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
              </select>
              {errors.routeId && <p className="text-xs text-red-600 mt-1">{errors.routeId}</p>}
            </div>
            {form.customerId && form.productVariantId && (
              <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
                <p className="font-medium text-blue-900">
                  Customer pricing category: {appliedCategoryName || 'Not set'}
                </p>
                <p className="text-blue-800">
                  Applied billing price:{' '}
                  {appliedPrice ? `₹${Number(appliedPrice.price).toFixed(2)} (effective ${appliedPrice.effectiveDate})` : 'Not set'}
                </p>
                {!appliedPrice && (
                  <p className="text-xs text-red-700 mt-1">
                    No active price found for this variant and category. Add it on the Pricing page before saving.
                  </p>
                )}
              </div>
            )}
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
          <label htmlFor="deliverySession" className="block text-sm font-medium text-gray-700 mb-1">Delivery Session *</label>
          <select
            id="deliverySession"
            value={form.deliverySession}
            onChange={(e) => setForm({ ...form, deliverySession: e.target.value })}
            className={fieldClass('deliverySession')}
          >
            {DELIVERY_SESSIONS.map((session) => (
              <option key={session.value} value={session.value}>{session.label}</option>
            ))}
          </select>
        </div>

        {isEdit && (
          <div>
            <label htmlFor="routeId-edit" className="block text-sm font-medium text-gray-700 mb-1">Route *</label>
            <select id="routeId-edit" value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} className={fieldClass('routeId')} required>
              <option value="">Select route</option>
              {routesData?.data?.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
            </select>
            {errors.routeId && <p className="text-xs text-red-600 mt-1">{errors.routeId}</p>}
          </div>
        )}

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

        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Pack Breakdown</h2>
              <p className="text-xs text-gray-500">Use this to deliver one quantity in multiple cans, for example 20L + 20L + 10L.</p>
            </div>
            <button
              type="button"
              onClick={() => setPackRows((prev) => [...prev, createEmptyPackRow()])}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              + Add Pack
            </button>
          </div>
          <div className="space-y-2">
            {packRows.map((pack, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={pack.packSize}
                  onChange={(e) =>
                    setPackRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, packSize: e.target.value } : row))
                  }
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Pack size (L)"
                />
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={pack.packCount}
                  onChange={(e) =>
                    setPackRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, packCount: e.target.value } : row))
                  }
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Count"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPackRows((prev) => (prev.length === 1 ? [createEmptyPackRow()] : prev.filter((_, rowIndex) => rowIndex !== index)))
                  }
                  className="rounded-md border border-red-200 px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <p>Pack total: {packTotal || 0}</p>
            <p>Summary: {formatPackSummary(packRows) || 'No pack breakdown added'}</p>
            {packMismatch && (
              <p className="mt-1 text-red-700">
                Pack total must match quantity before saving.
              </p>
            )}
            {errors.packBreakdown && <p className="mt-1 text-red-700">{errors.packBreakdown}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate('/subscriptions')} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={mutation.isPending || packMismatch} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
