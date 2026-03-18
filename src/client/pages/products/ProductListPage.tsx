import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface Variant { id: string; unitType: string; quantityPerUnit: number; sku?: string; isActive: boolean; }
interface Product { id: string; name: string; category?: string; description?: string; isActive: boolean; variants?: Variant[]; createdAt: string; }
interface ListResponse { data: Product[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

export default function ProductListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search],
    queryFn: () => api.get<ListResponse>(`/api/v1/products?${params}`),
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <Link to="/products/new" className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">+ New Product</Link>
      </div>

      <div className="mb-4">
        <input type="text" placeholder="Search products…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Search products" />
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      <div className="space-y-3">
        {data?.data?.map((p) => (
          <div key={p.id} className="bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => toggleExpand(p.id)} tabIndex={0} role="button" onKeyDown={(e) => e.key === 'Enter' && toggleExpand(p.id)} aria-expanded={expanded.has(p.id)}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">{p.name}</span>
                {p.category && <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{p.category}</span>}
                {!p.isActive && <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">Inactive</span>}
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/products/${p.id}/edit`} onClick={(e) => e.stopPropagation()} className="text-xs text-blue-600 hover:underline">Edit</Link>
                <span className="text-gray-400 text-xs">{expanded.has(p.id) ? '▲' : '▼'}</span>
              </div>
            </div>
            {expanded.has(p.id) && (
              <div className="border-t border-gray-100 px-4 py-3">
                {p.description && <p className="text-sm text-gray-600 mb-3">{p.description}</p>}
                <VariantList productId={p.id} />
              </div>
            )}
          </div>
        ))}
        {data?.data?.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No products found</p>}
      </div>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {data.pagination.page} of {data.pagination.totalPages}</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function VariantList({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: () => api.get<{ data: Array<{ id: string; unitType: string; quantityPerUnit: number; sku?: string; isActive: boolean }> }>(`/api/v1/products/${productId}/variants`),
  });

  const [priceView, setPriceView] = useState<string | null>(null);

  if (isLoading) return <p className="text-xs text-gray-500">Loading variants…</p>;
  if (!data?.data?.length) return <p className="text-xs text-gray-500">No variants</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase">Variants</p>
      {data.data.map((v) => (
        <div key={v.id} className="border border-gray-100 rounded p-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{v.quantityPerUnit} {v.unitType} {v.sku ? `(${v.sku})` : ''} {!v.isActive && <span className="text-xs text-red-600">Inactive</span>}</span>
            <button onClick={() => setPriceView(priceView === v.id ? null : v.id)} className="text-xs text-blue-600 hover:underline">
              {priceView === v.id ? 'Hide Prices' : 'Prices'}
            </button>
          </div>
          {priceView === v.id && <PriceHistory productId={productId} variantId={v.id} />}
        </div>
      ))}
    </div>
  );
}

function PriceHistory({ productId, variantId }: { productId: string; variantId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['price-history', productId, variantId],
    queryFn: () => api.get<{ data: Array<{ id: string; price: number; effectiveDate: string; branch?: string | null; pricingCategory?: string | null }> }>(`/api/v1/products/${productId}/variants/${variantId}/prices`),
  });

  if (isLoading) return <p className="text-xs text-gray-400 mt-1">Loading prices…</p>;
  if (!data?.data?.length) return <p className="text-xs text-gray-400 mt-1">No price history</p>;

  return (
    <table className="mt-2 w-full text-xs">
      <thead><tr className="text-gray-500">
        <th className="text-left py-1">Effective Date</th><th className="text-right py-1">Price</th><th className="text-left py-1 pl-3">Category</th><th className="text-left py-1 pl-3">Branch</th>
      </tr></thead>
      <tbody>
        {data.data.map((p) => (
          <tr key={p.id} className="border-t border-gray-50">
            <td className="py-1">{p.effectiveDate}</td>
            <td className="py-1 text-right">₹{Number(p.price).toFixed(2)}</td>
            <td className="py-1 pl-3">{p.pricingCategory ? p.pricingCategory.replace('_', ' ').toUpperCase() : 'Default'}</td>
            <td className="py-1 pl-3">{p.branch ?? 'All branches'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
