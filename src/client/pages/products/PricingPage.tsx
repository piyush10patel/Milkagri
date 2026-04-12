import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface LatestPrice {
  id: string;
  price: number;
  effectiveDate: string;
}

interface PricingCategoryOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface PricingRow {
  id: string;
  sku?: string | null;
  unitType: string;
  quantityPerUnit: number;
  product: { id: string; name: string };
  latestPrices: {
    default: LatestPrice | null;
    categories: Record<string, LatestPrice | null>;
  };
}

interface PricingMatrixResponse {
  categories: PricingCategoryOption[];
  rows: PricingRow[];
}

interface PriceEditorState {
  variantId: string;
  productId: string;
  effectiveDate: string;
  prices: Record<string, string>;
}

function formatCurrency(price: LatestPrice | null) {
  return price ? `Rs ${Number(price.price).toFixed(2)}` : 'Not set';
}

function formatDate(price: LatestPrice | null) {
  return price?.effectiveDate ?? '-';
}

export default function PricingPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<PriceEditorState | null>(null);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pricing-matrix'],
    queryFn: () => api.get<{ data: PricingMatrixResponse }>('/api/v1/products/pricing-matrix'),
  });

  const { data: pricingCategoriesData } = useQuery({
    queryKey: ['pricing-categories-admin'],
    queryFn: () => api.get<{ data: PricingCategoryOption[] }>('/api/v1/pricing-categories?includeInactive=true'),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: PriceEditorState) => {
      const requests: Promise<unknown>[] = [];

      for (const [categoryCode, value] of Object.entries(payload.prices)) {
        if (!value.trim()) continue;
        requests.push(
          api.post(`/api/v1/products/${payload.productId}/variants/${payload.variantId}/prices`, {
            price: Number(value),
            effectiveDate: payload.effectiveDate,
            pricingCategory: categoryCode === 'default' ? null : categoryCode,
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
      setInfoMessage('Prices saved successfully.');
    },
    onError: (err: { message?: string }) => {
      setError(err.message ?? 'Failed to save prices');
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => api.post('/api/v1/pricing-categories', { name }),
    onSuccess: () => {
      setNewCategoryName('');
      setError('');
      setInfoMessage('Pricing category added. Now click "Set Prices" on a product row below to assign prices for that category.');
      queryClient.invalidateQueries({ queryKey: ['pricing-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-matrix'] });
    },
    onError: (err: { message?: string }) => {
      setError(err.message ?? 'Failed to create pricing category');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/api/v1/pricing-categories/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-matrix'] });
    },
    onError: (err: { message?: string }) => {
      setError(err.message ?? 'Failed to update pricing category');
    },
  });

  const rows = useMemo(() => {
    const items = data?.data?.rows ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((row) =>
      row.product.name.toLowerCase().includes(term) ||
      `${row.quantityPerUnit} ${row.unitType}`.toLowerCase().includes(term) ||
      (row.sku ?? '').toLowerCase().includes(term),
    );
  }, [data, search]);

  const activeCategories = data?.data?.categories ?? [];

  function openEditor(row: PricingRow) {
    setError('');
    setInfoMessage('');
    const prices: Record<string, string> = {
      default: row.latestPrices.default ? String(Number(row.latestPrices.default.price)) : '',
    };

    activeCategories.forEach((category) => {
      prices[category.code] = row.latestPrices.categories[category.code]
        ? String(Number(row.latestPrices.categories[category.code]?.price))
        : '';
    });

    setEditor({
      variantId: row.id,
      productId: row.product.id,
      prices,
      effectiveDate:
        row.latestPrices.default?.effectiveDate ||
        activeCategories
          .map((category) => row.latestPrices.categories[category.code]?.effectiveDate)
          .find(Boolean) ||
        new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Pricing Plan</h1>
            <p className="text-sm text-gray-500">
              The button here adds a pricing category only. To set the price for a specific milk or product variant, use the
              product rows below and click "Set Prices".
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              setInfoMessage('');
              if (!newCategoryName.trim()) {
                setError('Enter a pricing category name before adding.');
                return;
              }
              createCategoryMutation.mutate(newCategoryName.trim());
            }}
            className="flex w-full max-w-md gap-2"
          >
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Add pricing category, e.g. wholesale"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={createCategoryMutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createCategoryMutation.isPending ? 'Adding...' : 'Add Category'}
            </button>
          </form>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(pricingCategoriesData?.data ?? []).map((category) => (
            <div key={category.id} className={`rounded-full border px-3 py-1.5 text-xs ${category.isActive ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-100 text-gray-600'}`}>
              <span className="font-medium">{category.name}</span>
              <span className="ml-2 text-[11px] uppercase">{category.code}</span>
              <button
                type="button"
                onClick={() => updateCategoryMutation.mutate({ id: category.id, isActive: !category.isActive })}
                className="ml-3 underline"
              >
                {category.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {infoMessage && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {infoMessage}
        </div>
      )}

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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Variant</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
              {activeCategories.map((category) => (
                <th key={category.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{category.name}</th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => {
              const label = `${row.product.name} - ${row.quantityPerUnit} ${row.unitType}${row.sku ? ` (${row.sku})` : ''}`;
              const isEditing = editor?.variantId === row.id;

              return (
                <tr key={row.id} className={isEditing ? 'bg-blue-50/50' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{label}</td>
                  <td className="px-4 py-3 text-sm">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editor.prices.default}
                        onChange={(e) => setEditor((current) => current ? { ...current, prices: { ...current.prices, default: e.target.value } } : current)}
                        className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    ) : (
                      <div className="font-medium">{formatCurrency(row.latestPrices.default)}</div>
                    )}
                  </td>
                  {activeCategories.map((category) => (
                    <td key={category.id} className="px-4 py-3 text-sm">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={editor.prices[category.code] ?? ''}
                          onChange={(e) => setEditor((current) => current ? { ...current, prices: { ...current.prices, [category.code]: e.target.value } } : current)}
                          className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      ) : (
                        <div className="font-medium">{formatCurrency(row.latestPrices.categories[category.code] ?? null)}</div>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {isEditing ? (
                      <input
                        type="date"
                        value={editor.effectiveDate}
                        onChange={(e) => setEditor((current) => current ? { ...current, effectiveDate: e.target.value } : current)}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    ) : (
                      <div className="space-y-1 text-xs">
                        <div>Default: {formatDate(row.latestPrices.default)}</div>
                        {activeCategories.map((category) => (
                          <div key={category.id}>{category.name}: {formatDate(row.latestPrices.categories[category.code] ?? null)}</div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditor(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
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
                      <button type="button" onClick={() => openEditor(row)} className="text-blue-600 hover:underline">Set Prices</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={activeCategories.length + 4} className="px-4 py-8 text-center text-sm text-gray-500">No variants found</td>
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
