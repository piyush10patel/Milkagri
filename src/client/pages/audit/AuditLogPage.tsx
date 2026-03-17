import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AuditLog {
  id: string;
  userId: string;
  userRole: string;
  actionType: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  createdAt: string;
  user?: { name: string; email: string };
}

interface ListResponse {
  data: AuditLog[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-yellow-100 text-yellow-800',
  delete: 'bg-red-100 text-red-800',
};

const ENTITY_TYPES = [
  '', 'customer', 'product', 'product_variant', 'subscription', 'delivery_order',
  'invoice', 'payment', 'route', 'user', 'holiday', 'setting',
];

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actionType, setActionType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 25;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  if (entityType) params.set('entityType', entityType);
  if (actionType) params.set('actionType', actionType);
  if (startDate) params.set('startDate', new Date(startDate).toISOString());
  if (endDate) params.set('endDate', new Date(endDate + 'T23:59:59').toISOString());

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, entityType, actionType, startDate, endDate],
    queryFn: () => api.get<ListResponse>(`/api/v1/audit-logs?${params}`),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Audit Log</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search audit logs"
        />
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by entity type"
        >
          <option value="">All entities</option>
          {ENTITY_TYPES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={actionType}
          onChange={(e) => { setActionType(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by action type"
        >
          <option value="">All actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="End date"
        />
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity ID</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.data?.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  {log.user?.name ?? log.userId.slice(0, 8)}
                  <span className="block text-xs text-gray-400">{log.userRole.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[log.actionType] ?? ''}`}>
                    {log.actionType}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{log.entityType.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">{log.entityId.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-sm">
                  {log.changes && Object.keys(log.changes).length > 0 ? (
                    <button
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      {expanded === log.id ? 'Hide' : 'Show'} changes
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
            {data?.data?.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No audit logs found</td></tr>
            )}
          </tbody>
        </table>

        {/* Expanded changes detail */}
        {expanded && data?.data?.find((l) => l.id === expanded)?.changes && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Changes:</p>
            <div className="space-y-1">
              {Object.entries(data.data.find((l) => l.id === expanded)!.changes!).map(([field, vals]) => (
                <div key={field} className="text-xs">
                  <span className="font-medium text-gray-700">{field}:</span>{' '}
                  <span className="text-red-600">{JSON.stringify(vals.old)}</span>
                  {' → '}
                  <span className="text-green-600">{JSON.stringify(vals.new)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <button disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
