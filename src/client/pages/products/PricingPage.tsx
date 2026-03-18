import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface LatestPrice {
  id: string;
  price: number;
  effectiveDate: string;
}

interface PricingRow {
  id: string;
  sku?: string | null;
  unitType: string;
  quantityPerUnit: number;
  product: { id: string; name: string };
  latestPrices: {
    default: LatestPrice | null;
    cat_1: LatestPrice | null;
    cat_2: LatestPrice | null;
    cat_3: LatestPrice | null;
  };
}

interface PriceEditorState {
  variantId: string;
  productId: string;
  defaultPrice: string;
  cat1Price: string;
  cat2Price: string;
  effectiveDate: string;
}

function formatCurrency(price: LatestPrice | null) {
  return price ? `₹${Number(price.price).toFixed(2)}` : 'Not set';
}

function formatDate(price: LatestPrice | null) {
  return price?.effectiveDate ?? '-';
}

export default function PricingPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<PriceEditorState | null>(null);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pricing-matrix'],
    queryFn: () => api.get<{ data: PricingRow[] }>('/api/v1/products/pricing-matrix'),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: PriceEditorState) => {
      const requests: Promise<unknown>[] = [];

      const entries = [
        { pricingCategory: null, value: payload.defaultPrice },
        { pricingCategory: 'cat_1', value: payload.cat1Price },
        { pricingCategory: 'cat_2', value: payload.cat2Price },
      ] as const;

      for (const entry of entries) {
        if (!entry.value.trim()) continue;
        requests.push(
          api.post(`/api/v1/products/${payload.productId}/variants/${payload.variantId}/prices`, {
            price: Number(entry.value),
            effectiveDate: payload.effectiveDate,
            pricingCategory: entry.pricingCategory,
          }),
        );
      }

      if (requests.length === 0) {
        throw new Error('Enter at least one price to save.');
      }

      await Promise.all(requests);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-matrix'] });
      setEditor(null);
      setError('');
    },
    onError: (err: { message?: string }) => {
      setError(err.message ?? 'Failed to save prices');
    },
  });

  const rows = useMemo(() => {
    const items = data?.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((row) =>
      row.product.name.toLowerCase().includes(term) ||
      `${row.quantityPerUnit} ${row.unitType}`.toLowerCase().includes(term) ||
      (row.sku ?? '').toLowerCase().includes(term),
    );
  }, [data, search]);

  function openEditor(row: PricingRow) {
    setError('');
    setEditor({
      variantId: row.id,
      productId: row.product.id,
      defaultPrice: row.latestPrices.default ? String(Number(row.latestPrices.default.price)) : '',
      cat1Price: row.latestPrices.cat_1 ? String(Number(row.latestPrices.cat_1.price)) : '',
      cat2Price: row.latestPrices.cat_2 ? String(Number(row.latestPrices.cat_2.price)) : '',
      effectiveDate:
        row.latestPrices.cat_1?.effectiveDate ||
        row.latestPrices.cat_2?.effectiveDate ||
        row.latestPrices.default?.effectiveDate ||
        new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pricing Plan</h1>
          <p className="text-sm text-gray-500">Manage variant prices in one place, for example: Buffalo Milk - Cat 1 = 65, Cat 2 = 60.</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by product, SKU, or size..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full sm:w-96 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading pricing...</p>}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Variant</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cat 1</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cat 2</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => {
              const label = `${row.product.name} - ${row.quantityPerUnit} ${row.unitType}${row.sku ? ` (${row.sku})` : ''}`;
              const isEditing = editor?.variantId === row.id;

              return (
                <tr key={row.id} className={isEditing ? 'bg-blue-50/50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{label}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editor.defaultPrice}
                        onChange={(e) => setEditor((current) => current ? { ...current, defaultPrice: e.target.value } : current)}
                        className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        placeholder="0.00"
                      />
                    ) : (
                      <div>
                        <div className="font-medium">{formatCurrency(row.latestPrices.default)}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editor.cat1Price}
                        onChange={(e) => setEditor((current) => current ? { ...current, cat1Price: e.target.value } : current)}
                        className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="font-medium">{formatCurrency(row.latestPrices.cat_1)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editor.cat2Price}
                        onChange={(e) => setEditor((current) => current ? { ...current, cat2Price: e.target.value } : current)}
                        className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="font-medium">{formatCurrency(row.latestPrices.cat_2)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {isEditing ? (
                      <input
                        type="date"
                        value={editor.effectiveDate}
                        onChange={(e) => setEditor((current) => current ? { ...current, effectiveDate: e.target.value } : current)}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    ) : (
                      <div className="text-xs">
                        <div>Default: {formatDate(row.latestPrices.default)}</div>
                        <div>Cat 1: {formatDate(row.latestPrices.cat_1)}</div>
                        <div>Cat 2: {formatDate(row.latestPrices.cat_2)}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditor(null);
                            setError('');
                          }}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => editor && saveMutation.mutate(editor)}
                          disabled={saveMutation.isPending}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saveMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openEditor(row)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit Prices
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No variants found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
