import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Notification {
  id: string;
  title: string;
  body: string;
  eventType: string;
  isRead: boolean;
  createdAt: string;
}

interface ListResponse {
  data: Notification[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filter) params.set('isRead', filter);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, filter],
    queryFn: () => api.get<ListResponse>(`/api/v1/notifications?${params}`),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Notifications</h1>

      <div className="flex gap-2 mb-4">
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by read status"
        >
          <option value="">All</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      <div className="space-y-2">
        {data?.data?.map((n) => (
          <div
            key={n.id}
            className={`bg-white rounded-lg border p-4 cursor-pointer transition-colors ${
              n.isRead ? 'border-gray-200' : 'border-blue-300 bg-blue-50'
            }`}
            onClick={() => { if (!n.isRead) markReadMutation.mutate(n.id); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' && !n.isRead) markReadMutation.mutate(n.id); }}
            aria-label={`${n.isRead ? 'Read' : 'Unread'} notification: ${n.title}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {!n.isRead && <span className="inline-block w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                  <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                </div>
                <p className="text-sm text-gray-600 mt-1">{n.body}</p>
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </div>
            <span className="inline-block mt-2 rounded-full bg-gray-100 text-gray-600 text-xs px-2 py-0.5">
              {n.eventType.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
        {data?.data?.length === 0 && !isLoading && (
          <p className="text-sm text-gray-500 text-center py-8">No notifications</p>
        )}
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
