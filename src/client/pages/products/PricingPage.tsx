import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface LatestPrice { id: string; price: number; effectiveDate: string; }
interface Category { id: string; code: string; name: string; isActive: boolean; }
interface PricingRow {
  id: string; sku?: string | null; unitType: string; quantityPerUnit: number;
  product: { id: string; name: string };
  latestPrices: { default: LatestPrice | null; categories: Record<string, LatestPrice | null> };
}
interface MatrixResp { categories: Category[]; rows: PricingRow[]; }
type RowPrices = Record<string, string>; // 'default' | categoryCode -> price string

function priceVal(p: LatestPrice | null) { return p ? String(Number(p.price)) : ''; }

export default function PricingPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [showCats, setShowCats] = useState(false);
  const [prices, setPrices] = useState<Record<string, RowPrices>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['pricing-matrix'],
    queryFn: () => api.get<{ data: MatrixResp }>('/api/v1/products/pricing-matrix'),
  });
  const { data: allCats } = useQuery({
    queryKey: ['pricing-categories-admin'],
    queryFn: () => api.get<{ data: Category[] }>('/api/v1/pricing-categories?includeInactive=true'),
  });

  const activeCats = data?.data?.categories ?? [];
  const rows = useMemo(() => {
    const items = data?.data?.rows ?? [];
    const t = search.trim().toLowerCase();
    if (!t) return items;
    return items.filter(r =>
      r.product.name.toLowerCase().includes(t) ||
      `${r.quantityPerUnit} ${r.unitType}`.toLowerCase().includes(t) ||
      (r.sku ?? '').toLowerCase().includes(t));
  }, [data, search]);

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

  function updatePrice(variantId: string, key: string, val: string) {
    setPrices(prev => ({ ...prev, [variantId]: { ...prev[variantId], [key]: val } }));
    setDirty(prev => new Set(prev).add(variantId));
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
        const existing = key === 'default' ? row.latestPrices.default : row.latestPrices.categories[key];
        if (existing && String(Number(existing.price)) === val.trim()) continue; // unchanged
        reqs.push(api.post(`/api/v1/products/${row.product.id}/variants/${row.id}/prices`, {
          price: Number(val), effectiveDate: today, pricingCategory: key === 'default' ? null : key,
        }));
      }
      if (reqs.length === 0) { setSaving(prev => { const n = new Set(prev); n.delete(row.id); return n; }); return; }
      await Promise.all(reqs);
      qc.invalidateQueries({ queryKey: ['pricing-matrix'] });
      setDirty(prev => { const n = new Set(prev); n.delete(row.id); return n; });
      setSuccess(`Saved prices for ${row.product.name} - ${row.quantityPerUnit} ${row.unitType}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(row.id); return n; });
    }
  }

  const createCat = useMutation({
    mutationFn: (name: string) => api.post('/api/v1/pricing-categories', { name }),
    onSuccess: () => { setNewCatName(''); qc.invalidateQueries({ queryKey: ['pricing-categories-admin'] }); qc.invalidateQueries({ queryKey: ['pricing-matrix'] }); setSuccess('Category created.'); },
    onError: (e: any) => setError(e.message ?? 'Failed to create category'),
  });
  const toggleCat = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/api/v1/pricing-categories/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pricing-categories-admin'] }); qc.invalidateQueries({ queryKey: ['pricing-matrix'] }); },
    onError: (e: any) => setError(e.message ?? 'Failed to update category'),
  });

  return (
    <div>
      {/* Header with category management */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Pricing Plan</h1>
          <button type="button" onClick={() => setShowCats(!showCats)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {showCats ? 'Hide' : 'Manage'} Categories
          </button>
        </div>

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

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Variant</th>
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
              const label = `${row.product.name} - ${row.quantityPerUnit} ${row.unitType}${row.sku ? ` (${row.sku})` : ''}`;
              return (
                <tr key={row.id} className={isDirty ? 'bg-yellow-50/50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{label}</td>
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
              <tr><td colSpan={activeCats.length + 3} className="px-4 py-8 text-center text-sm text-gray-500">No product variants found. Add products first.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
