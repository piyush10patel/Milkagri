import { useEffect, useState } from 'react';
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
  const [pushStatus, setPushStatus] = useState<'idle' | 'enabled' | 'disabled' | 'unsupported'>('idle');
  const [pushBusy, setPushBusy] = useState(false);
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

  async function getRegistration() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const registration = await navigator.serviceWorker.ready;
    return registration;
  }

  async function refreshPushStatus() {
    const registration = await getRegistration();
    if (!registration) {
      setPushStatus('unsupported');
      return;
    }
    const existing = await registration.pushManager.getSubscription();
    setPushStatus(existing ? 'enabled' : 'disabled');
  }

  useEffect(() => {
    refreshPushStatus().catch(() => setPushStatus('unsupported'));
  }, []);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function enablePush() {
    try {
      setPushBusy(true);
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('disabled');
        return;
      }
      const registration = await getRegistration();
      if (!registration) {
        setPushStatus('unsupported');
        return;
      }
      const { publicKey } = await api.get<{ publicKey: string }>('/api/v1/notifications/push/public-key');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api.post('/api/v1/notifications/push/subscribe', subscription.toJSON());
      setPushStatus('enabled');
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    try {
      setPushBusy(true);
      const registration = await getRegistration();
      if (!registration) return;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.delete('/api/v1/notifications/push/subscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setPushStatus('disabled');
    } finally {
      setPushBusy(false);
    }
  }

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
        <button
          type="button"
          onClick={() => (pushStatus === 'enabled' ? disablePush() : enablePush())}
          disabled={pushBusy || pushStatus === 'unsupported'}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {pushBusy ? 'Working...' : pushStatus === 'enabled' ? 'Disable Push' : 'Enable Push'}
        </button>
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
