import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

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
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RouteItem | null>(null);
  const closeDeleteModal = useCallback(() => setDeleteTarget(null), []);
  const { modalRef: deleteModalRef } = useModalFocusTrap(!!deleteTarget, closeDeleteModal);
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);

  const { data, isLoading } = useQuery({
    queryKey: ['routes', page, search],
    queryFn: () => api.get<ListResponse>(`/api/v1/routes?${params}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (routeId: string) => api.delete(`/api/v1/routes/${routeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      setDeleteTarget(null);
    },
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
                <td className="px-4 py-3 text-sm text-right space-x-2">
                  <Link to={`/routes/${r.id}/edit`} className="text-blue-600 hover:underline text-xs">Edit</Link>
                  <button type="button" onClick={() => setDeleteTarget(r)} className="text-red-700 hover:underline text-xs">Delete</button>
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="delete-route-title">
          <div ref={deleteModalRef} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="delete-route-title" className="text-lg font-semibold text-gray-900 mb-2">Delete Route</h2>
            <p className="text-sm text-gray-600 mb-4">
              Permanently delete <span className="font-medium">{deleteTarget.name}</span>.
              Routes with assigned customers or delivery order history cannot be deleted.
            </p>
            {deleteMutation.isError && (
              <p className="mb-4 text-sm text-red-600">
                Failed to delete route. Reassign customers first, and if the route has delivery history, deactivate it instead.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={closeDeleteModal} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
