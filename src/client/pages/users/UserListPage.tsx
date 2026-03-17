import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

interface UserItem { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt?: string; createdAt: string; }
interface ListResponse { data: UserItem[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

const ROLE_LABELS: Record<string, string> = { super_admin: 'Super Admin', admin: 'Admin', delivery_agent: 'Delivery Agent', billing_staff: 'Billing Staff', read_only: 'Read Only' };

export default function UserListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [deactivateTarget, setDeactivateTarget] = useState<string | null>(null);
  const closeDeactivate = useCallback(() => setDeactivateTarget(null), []);
  const { modalRef: deactivateModalRef } = useModalFocusTrap(!!deactivateTarget, closeDeactivate);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => api.get<ListResponse>(`/api/v1/users?page=${page}&limit=${limit}`),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/users/${id}/deactivate`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setDeactivateTarget(null); },
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Staff Users</h1>
        <Link to="/users/new" className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">+ New User</Link>
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {data?.data?.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{u.email}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="inline-block rounded-full bg-blue-100 text-blue-800 text-xs px-2 py-0.5">{ROLE_LABELS[u.role] ?? u.role}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right space-x-2">
                  <Link to={`/users/${u.id}/edit`} className="text-blue-600 hover:underline text-xs">Edit</Link>
                  {u.isActive && (
                    <button onClick={() => setDeactivateTarget(u.id)} className="text-red-600 hover:underline text-xs">Deactivate</button>
                  )}
                </td>
              </tr>
            ))}
            {data?.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No users found</td></tr>}
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

      {/* Deactivation confirmation */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="deactivate-title">
          <div ref={deactivateModalRef} className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 id="deactivate-title" className="text-lg font-semibold text-gray-900 mb-2">Deactivate User</h2>
            <p className="text-sm text-gray-600 mb-4">This will immediately invalidate all active sessions for this user. Are you sure?</p>
            <div className="flex justify-end gap-2">
              <button onClick={closeDeactivate} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={() => deactivateMutation.mutate(deactivateTarget)} disabled={deactivateMutation.isPending} className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50">
                {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
