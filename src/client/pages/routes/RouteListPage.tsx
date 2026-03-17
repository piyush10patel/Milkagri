import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface RouteItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  _count?: { customers: number; agents: number };
  createdAt: string;
}

interface ListResponse { data: RouteItem[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

export default function RouteListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['routes', page, search],
    queryFn: () => api.get<ListResponse>(`/api/v1/routes?${params}`),
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Routes</h1>
        <Link to="/routes/new" className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">+ New Route</Link>
      </div>

      <div className="mb-4">
        <input type="text" placeholder="Search routes…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Search routes" />
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Customers</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Agents</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {data?.data?.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{r.description || '—'}</td>
                <td className="px-4 py-3 text-sm text-center">{r._count?.customers ?? 0}</td>
                <td className="px-4 py-3 text-sm text-center">{r._count?.agents ?? 0}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <Link to={`/routes/${r.id}/edit`} className="text-blue-600 hover:underline text-xs">Edit</Link>
                </td>
              </tr>
            ))}
            {data?.data?.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No routes found</td></tr>}
          </tbody>
        </table>
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
