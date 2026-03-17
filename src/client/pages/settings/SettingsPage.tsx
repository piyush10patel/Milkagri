import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface NotifPref {
  dashboard: boolean;
  email: boolean;
}

interface Settings {
  billingCycleStartDay: number;
  cutoffTime: string;
  notificationPreferences: {
    dailyGenerationFailure: NotifPref;
    billingError: NotifPref;
    accountLockout: NotifPref;
  };
}

interface Holiday {
  id: string;
  holidayDate: string;
  description?: string;
  isSystemWide: boolean;
}

interface HolidayListResponse {
  data: Holiday[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // Settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/api/v1/settings'),
  });

  const [billingDay, setBillingDay] = useState(1);
  const [cutoff, setCutoff] = useState('18:00');
  const [notifPrefs, setNotifPrefs] = useState<Settings['notificationPreferences']>({
    dailyGenerationFailure: { dashboard: true, email: true },
    billingError: { dashboard: true, email: true },
    accountLockout: { dashboard: true, email: false },
  });

  useEffect(() => {
    if (settings) {
      setBillingDay(settings.billingCycleStartDay);
      setCutoff(settings.cutoffTime);
      setNotifPrefs(settings.notificationPreferences);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => api.put<Settings>('/api/v1/settings', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  function handleSave() {
    saveMutation.mutate({
      billingCycleStartDay: billingDay,
      cutoffTime: cutoff,
      notificationPreferences: notifPrefs,
    });
  }

  function toggleNotif(event: keyof typeof notifPrefs, channel: 'dashboard' | 'email') {
    setNotifPrefs((prev) => ({
      ...prev,
      [event]: { ...prev[event], [channel]: !prev[event][channel] },
    }));
  }

  // Holidays
  const [holidayPage, setHolidayPage] = useState(1);
  const { data: holidayData } = useQuery({
    queryKey: ['holidays', holidayPage],
    queryFn: () => api.get<HolidayListResponse>(`/api/v1/holidays?page=${holidayPage}&limit=20`),
  });

  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');

  const addHolidayMutation = useMutation({
    mutationFn: (data: { holidayDate: string; description?: string }) =>
      api.post('/api/v1/holidays', { ...data, isSystemWide: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setNewHolidayDate('');
      setNewHolidayDesc('');
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/holidays/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });

  if (isLoading) return <p className="text-sm text-gray-500" aria-live="polite">Loading settings…</p>;

  const NOTIF_EVENTS: { key: keyof typeof notifPrefs; label: string }[] = [
    { key: 'dailyGenerationFailure', label: 'Daily Generation Failure' },
    { key: 'billingError', label: 'Billing Error' },
    { key: 'accountLockout', label: 'Account Lockout' },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">System Settings</h1>

      {/* Billing & Cutoff */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Billing Configuration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="billingDay" className="block text-sm text-gray-600 mb-1">Billing Cycle Start Day</label>
            <input
              id="billingDay"
              type="number"
              min={1}
              max={28}
              value={billingDay}
              onChange={(e) => setBillingDay(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Day of month (1–28)</p>
          </div>
          <div>
            <label htmlFor="cutoff" className="block text-sm text-gray-600 mb-1">Cutoff Time</label>
            <input
              id="cutoff"
              type="time"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Changes after this time apply to next delivery</p>
          </div>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Notification Preferences</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Dashboard</th>
                <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {NOTIF_EVENTS.map((evt) => (
                <tr key={evt.key}>
                  <td className="px-4 py-2 text-sm">{evt.label}</td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={notifPrefs[evt.key].dashboard}
                      onChange={() => toggleNotif(evt.key, 'dashboard')}
                      aria-label={`${evt.label} dashboard notification`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={notifPrefs[evt.key].email}
                      onChange={() => toggleNotif(evt.key, 'email')}
                      aria-label={`${evt.label} email notification`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 mb-8"
      >
        {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
      </button>
      {saveMutation.isSuccess && <span className="ml-3 text-sm text-green-600">Saved</span>}
      {saveMutation.isError && <span className="ml-3 text-sm text-red-600">Failed to save</span>}

      {/* Holiday Calendar */}
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Holiday Calendar</h2>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Holiday date"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newHolidayDesc}
            onChange={(e) => setNewHolidayDesc(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Holiday description"
          />
          <button
            onClick={() => addHolidayMutation.mutate({ holidayDate: newHolidayDate, description: newHolidayDesc || undefined })}
            disabled={!newHolidayDate || addHolidayMutation.isPending}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add Holiday
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {holidayData?.data?.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{h.holidayDate}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{h.description || '—'}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    <button
                      onClick={() => deleteHolidayMutation.mutate(h.id)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {(!holidayData?.data || holidayData.data.length === 0) && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">No holidays configured</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {holidayData?.pagination && holidayData.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-500">Page {holidayData.pagination.page} of {holidayData.pagination.totalPages}</p>
            <div className="flex gap-2">
              <button disabled={holidayPage <= 1} onClick={() => setHolidayPage(holidayPage - 1)} className="rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-50">Prev</button>
              <button disabled={holidayPage >= holidayData.pagination.totalPages} onClick={() => setHolidayPage(holidayPage + 1)} className="rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
