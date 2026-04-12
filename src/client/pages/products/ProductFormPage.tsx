import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/lib/api';

interface ProductData { id: string; name: string; category?: string; description?: string; isActive: boolean; prices?: PriceRecord[]; }
interface VariantData { id: string; unitType: string; quantityPerUnit: number; sku?: string; isActive: boolean; }
interface PriceRecord {
  id: string;
  price: number;
  effectiveDate: string;
  branch?: string | null;
  pricingCategory?: string | null;
}

export default function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ name: '', category: '', description: '', defaultPrice: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Variant form (for edit mode)
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantForm, setVariantForm] = useState({ unitType: 'liters', quantityPerUnit: '', sku: '' });

  const { data: existing } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<{ data: ProductData }>(`/api/v1/products/${id}`),
    enabled: isEdit,
  });

  const { data: variantsData, refetch: refetchVariants } = useQuery({
    queryKey: ['product-variants', id],
    queryFn: () => api.get<{ data: VariantData[] }>(`/api/v1/products/${id}/variants`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing?.data) {
      const p = existing.data;
      // Find the current default price (null pricingCategory, null branch, most recent)
      const defaultPriceRecord = p.prices?.find(
        (pr) => pr.pricingCategory == null && pr.branch == null,
      );
      setForm({
        name: p.name,
        category: p.category ?? '',
        description: p.description ?? '',
        defaultPrice: defaultPriceRecord ? String(Number(defaultPriceRecord.price)) : '',
      });
    }
  }, [existing]);

  const productMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEdit ? api.put(`/api/v1/products/${id}`, data) : api.post<{ data: { id: string } }>('/api/v1/products', data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (!isEdit && result && typeof result === 'object' && 'data' in result) {
        navigate(`/products/${(result as { data: { id: string } }).data.id}/edit`);
      } else {
        navigate('/products');
      }
    },
    onError: (err: ApiError) => {
      if (err.errors) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      else setErrors({ _form: err.message });
    },
  });

  const variantMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post(`/api/v1/products/${id}/variants`, data),
    onSuccess: () => { refetchVariants(); setShowVariantForm(false); setVariantForm({ unitType: 'liters', quantityPerUnit: '', sku: '' }); },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) => api.delete(`/api/v1/products/${id}/variants/${variantId}`),
    onSuccess: () => { refetchVariants(); queryClient.invalidateQueries({ queryKey: ['product', id] }); },
  });

  function validateDefaultPrice(value: string): string | null {
    if (!value.trim()) return 'Default price is required';
    const num = Number(value);
    if (isNaN(num) || num <= 0) return 'Default price must be a positive number';
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const priceError = validateDefaultPrice(form.defaultPrice);
    if (priceError) {
      setErrors({ defaultPrice: priceError });
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name,
      defaultPrice: Number(form.defaultPrice),
    };
    if (form.category) payload.category = form.category;
    if (form.description) payload.description = form.description;
    productMutation.mutate(payload);
  }

  function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    variantMutation.mutate({ unitType: variantForm.unitType, quantityPerUnit: Number(variantForm.quantityPerUnit), sku: variantForm.sku || undefined });
  }

  const fieldClass = (name: string) =>
    `w-full rounded-md border ${errors[name] ? 'border-red-500' : 'border-gray-300'} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">{isEdit ? 'Edit Product' : 'New Product'}</h1>

      {errors._form && <div role="alert" className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{errors._form}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 mb-4">
        <div>
          <label htmlFor="pname" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input id="pname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass('name')} required />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="defaultPrice" className="block text-sm font-medium text-gray-700 mb-1">Default Price (₹) *</label>
          <input
            id="defaultPrice"
            type="number"
            step="0.01"
            min="0.01"
            value={form.defaultPrice}
            onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
            className={fieldClass('defaultPrice')}
            required
            aria-describedby={errors.defaultPrice ? 'defaultPrice-error' : undefined}
          />
          {errors.defaultPrice && <p id="defaultPrice-error" className="text-xs text-red-600 mt-1">{errors.defaultPrice}</p>}
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={fieldClass('category')} />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={fieldClass('description')} rows={2} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate('/products')} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={productMutation.isPending} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {productMutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>

      {/* Variants section (edit mode only) — no price management, prices are now per-product */}
      {isEdit && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Variants</h2>
            <button type="button" onClick={() => setShowVariantForm(!showVariantForm)} className="text-xs text-blue-600 hover:underline">
              {showVariantForm ? 'Cancel' : '+ Add Variant'}
            </button>
          </div>

          {showVariantForm && (
            <form onSubmit={handleAddVariant} className="border border-gray-100 rounded p-3 mb-3 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="unitType" className="block text-xs text-gray-600 mb-1">Unit Type</label>
                  <select id="unitType" value={variantForm.unitType} onChange={(e) => setVariantForm({ ...variantForm, unitType: e.target.value })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                    {['liters', 'milliliters', 'packets', 'kilograms', 'pieces'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="qpu" className="block text-xs text-gray-600 mb-1">Qty per Unit</label>
                  <input id="qpu" type="number" step="0.001" min="0.001" value={variantForm.quantityPerUnit} onChange={(e) => setVariantForm({ ...variantForm, quantityPerUnit: e.target.value })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" required />
                </div>
                <div>
                  <label htmlFor="sku" className="block text-xs text-gray-600 mb-1">SKU</label>
                  <input id="sku" value={variantForm.sku} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                </div>
              </div>
              <button type="submit" disabled={variantMutation.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
                {variantMutation.isPending ? 'Adding…' : 'Add Variant'}
              </button>
            </form>
          )}

          {variantsData?.data?.map((v) => (
            <div key={v.id} className="border border-gray-100 rounded p-3 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">{v.quantityPerUnit} {v.unitType} {v.sku ? `(${v.sku})` : ''} {!v.isActive && <span className="text-xs text-red-600 ml-1">Inactive</span>}</span>
                <button
                  type="button"
                  onClick={() => { if (window.confirm('Delete this variant? If it has active subscriptions it will be deactivated instead.')) deleteVariantMutation.mutate(v.id); }}
                  disabled={deleteVariantMutation.isPending}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!variantsData?.data?.length && !showVariantForm && <p className="text-sm text-gray-500">No variants yet. Add one above.</p>}
        </div>
      )}
    </div>
  );
}
