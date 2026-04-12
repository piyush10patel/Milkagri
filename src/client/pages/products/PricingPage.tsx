import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface LatestPrice { price: number; effectiveDate: string; }
interface Category { id: string; code: string; name: string; }
interface PricingRow {
  id: string;
  name: string;
  category: string;
  latestPrices: {
    default: LatestPrice | null;
    categories: Record<string, LatestPrice | null>;
  };
}
interface MatrixResp { categories: Category[]; rows: PricingRow[]; }
interface AdminCategory { id: string; code: string; name: string; isActive: boolean; }
type RowPrices = Record<string, string>; // 'default' | categoryCode -> price string

function priceVal(p: LatestPrice | null) { return p ? String(Number(p.price)) : ''; }

export default function PricingPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCats, setShowCats] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [prices, setPrices] = useState<Record<string, RowPrices>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  // Add Pricing Variant form state
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantProductId, setVariantProductId] = useState('');
  const [variantCategoryName, setVariantCategoryName] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantSaving, setVariantSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['pricing-matrix'],
    queryFn: () => api.get<{ data: MatrixResp }>('/api/v1/products/pricing-matrix'),
  });
  const { data: allCats } = useQuery({
    queryKey: ['pricing-categories-admin'],
    queryFn: () => api.get<{ data: AdminCategory[] }>('/api/v1/pricing-categories?includeInactive=true'),
  });

  const activeCats = data?.data?.categories ?? [];
  const allRows = data?.data?.rows ?? [];

  // 6.4: Search filters by product name
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return allRows;
    return allRows.filter(r => r.name.toLowerCase().includes(t));
  }, [allRows, search]);

  // Sync server data into editable state
  useEffect(() => {
    if (!data?.data) return;
    const next: Record<string, RowPrices> = {};
    for (const row of data.data.rows) {
      next[row.id] = { default: priceVal(row.latestPrices.default) };
      for (const cat of data.data.categories) {
        next[row.id][cat.code] = priceVal(row.latestPrices.categories[cat.code] ?? null);
      }
    }
    setPrices(next);
    setDirty(new Set());
  }, [data]);

  // 6.6: Update inline price editing to save at product level
  function updatePrice(productId: string, key: string, val: string) {
    setPrices(prev => ({ ...prev, [productId]: { ...prev[productId], [key]: val } }));
    setDirty(prev => new Set(prev).add(productId));
  }

  async function saveRow(row: PricingRow) {
    const rowPrices = prices[row.id];
    if (!rowPrices) return;
    setSaving(prev => new Set(prev).add(row.id));
    setError('');
    setSuccess('');
    try {
      const reqs: Promise<unknown>[] = [];
      const today = new Date().toISOString().slice(0, 10);
      for (const [key, val] of Object.entries(rowPrices)) {
        if (!val.trim()) continue;
        const existing = key === 'default'
          ? row.latestPrices.default
          : row.latestPrices.categories[key];
        if (existing && String(Number(existing.price)) === val.trim()) continue;
        reqs.push(api.post(`/api/v1/products/${row.id}/prices`, {
          price: Number(val),
          effectiveDate: today,
          pricingCategory: key === 'default' ? null : key,
        }));
      }
      if (reqs.length === 0) {
        setSaving(prev => { const n = new Set(prev); n.delete(row.id); return n; });
        return;
      }
      await Promise.all(reqs);
      qc.invalidateQueries({ queryKey: ['pricing-matrix'] });
      setDirty(prev => { const n = new Set(prev); n.delete(row.id); return n; });
      setSuccess(`Saved prices for ${row.name}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(row.id); return n; });
    }
  }

  // 6.3: Wire "Add Pricing Variant" form to create PricingCategory + ProductPrice via API
  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!variantProductId || !variantCategoryName.trim() || !variantPrice.trim()) return;
    const priceNum = Number(variantPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Price must be a positive number');
      return;
    }
    setVariantSaving(true);
    setError('');
    setSuccess('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.post(`/api/v1/products/${variantProductId}/prices`, {
        price: priceNum,
        effectiveDate: today,
        pricingCategory: variantCategoryName.trim(),
      });
      qc.invalidateQueries({ queryKey: ['pricing-matrix'] });
      qc.invalidateQueries({ queryKey: ['pricing-categories-admin'] });
      setSuccess('Pricing variant added successfully.');
      setVariantProductId('');
      setVariantCategoryName('');
      setVariantPrice('');
      setShowVariantForm(false);
    } catch (e: any) {
      setError(e.message ?? 'Failed to add pricing variant');
    } finally {
      setVariantSaving(false);
    }
  }

  const createCat = useMutation({
    mutationFn: (name: string) => api.post('/api/v1/pricing-categories', { name }),
    onSuccess: () => {
      setNewCatName('');
      qc.invalidateQueries({ queryKey: ['pricing-categories-admin'] });
      qc.invalidateQueries({ queryKey: ['pricing-matrix'] });
      setSuccess('Category created.');
    },
    onError: (e: any) => setError(e.message ?? 'Failed to create category'),
  });
  const toggleCat = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/api/v1/pricing-categories/${id}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-categories-admin'] });
      qc.invalidateQueries({ queryKey: ['pricing-matrix'] });
    },
    onError: (e: any) => setError(e.message ?? 'Failed to update category'),
  });

  return (
    <div>
      {/* Header with category management and Add Pricing Variant */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Pricing Plan</h1>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowVariantForm(!showVariantForm); if (showVariantForm) { setVariantProductId(''); setVariantCategoryName(''); setVariantPrice(''); } }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              {showVariantForm ? 'Cancel' : 'Add Pricing Variant'}
            </button>
            <button type="button" onClick={() => setShowCats(!showCats)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {showCats ? 'Hide' : 'Manage'} Categories
            </button>
          </div>
        </div>

        {/* 6.2: Add Pricing Variant form */}
        {showVariantForm && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Add Pricing Variant</h2>
            <form onSubmit={handleAddVariant} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="variant-product" className="block text-xs font-medium text-gray-600 mb-1">Product</label>
                <select id="variant-product" value={variantProductId} onChange={e => setVariantProductId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required>
                  <option value="">Select a product...</option>
                  {allRows.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="variant-category" className="block text-xs font-medium text-gray-600 mb-1">Category Name</label>
                <input id="variant-category" type="text" value={variantCategoryName} onChange={e => setVariantCategoryName(e.target.value)}
                  placeholder="e.g. Cat 1, Wholesale" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
              </div>
              <div className="w-32">
                <label htmlFor="variant-price" className="block text-xs font-medium text-gray-600 mb-1">Price (₹)</label>
                <input id="variant-price" type="number" step="0.01" min="0.01" value={variantPrice} onChange={e => setVariantPrice(e.target.value)}
                  placeholder="0.00" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right" required />
              </div>
              <button type="submit" disabled={variantSaving || !variantProductId || !variantCategoryName.trim() || !variantPrice.trim()}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
                {variantSaving ? 'Saving...' : 'Add Variant'}
              </button>
            </form>
          </div>
        )}

        {showCats && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <form onSubmit={e => { e.preventDefault(); if (newCatName.trim()) createCat.mutate(newCatName.trim()); }}
              className="flex gap-2 mb-3">
              <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                placeholder="New category name, e.g. Wholesale" className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <button type="submit" disabled={createCat.isPending || !newCatName.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {createCat.isPending ? 'Adding...' : 'Add'}
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {(allCats?.data ?? []).map(cat => (
                <div key={cat.id} className={`rounded-full border px-3 py-1.5 text-xs flex items-center gap-2 ${cat.isActive ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-100 text-gray-500'}`}>
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-[10px] uppercase opacity-60">{cat.code}</span>
                  <button type="button" onClick={() => toggleCat.mutate({ id: cat.id, isActive: !cat.isActive })}
                    className="underline text-[11px]">{cat.isActive ? 'Deactivate' : 'Activate'}</button>
                </div>
              ))}
              {!(allCats?.data?.length) && <p className="text-xs text-gray-400">No categories yet. Add one above.</p>}
            </div>
          </div>
        )}
      </div>

      {success && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{success}</div>}
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-4">
        <input type="text" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full sm:w-96 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      {/* 6.1 & 6.5: One row per product with default price + category columns */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default (₹)</th>
              {activeCats.map(c => <th key={c.id} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{c.name} (₹)</th>)}
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map(row => {
              const rp = prices[row.id];
              const isDirty = dirty.has(row.id);
              const isSaving = saving.has(row.id);
              return (
                <tr key={row.id} className={isDirty ? 'bg-yellow-50/50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{row.name}</td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" min="0" value={rp?.default ?? ''} placeholder="—"
                      onChange={e => updatePrice(row.id, 'default', e.target.value)}
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-right" />
                  </td>
                  {activeCats.map(c => (
                    <td key={c.id} className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={rp?.[c.code] ?? ''} placeholder="—"
                        onChange={e => updatePrice(row.id, c.code, e.target.value)}
                        className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-right" />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    {isDirty && (
                      <button type="button" onClick={() => saveRow(row)} disabled={isSaving}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !isLoading && (
              <tr><td colSpan={activeCats.length + 3} className="px-4 py-8 text-center text-sm text-gray-500">No products found. Add products first.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
