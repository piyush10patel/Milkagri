import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { useState } from 'react';

interface DashboardStats {
  todayDeliveries: number;
  pendingDeliveries: number;
  monthRevenue: number;
  outstandingPayments: number;
  activeCustomers: number;
}

interface HandoverNote {
  id: string;
  noteDate: string;
  content: string;
  createdAt: string;
  creator: { id: string; name: string };
}

interface HandoverResponse {
  notes: HandoverNote[];
  startDate: string;
  endDate: string;
}

function StatCard({ label, value, format }: { label: string; value: number | undefined; format?: 'currency' }) {
  const display =
    value === undefined
      ? '—'
      : format === 'currency'
        ? `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
        : value.toLocaleString('en-IN');

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{display}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const now = new Date();
  const pad2 = (value: number) => String(value).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const monthStart = today.slice(0, 8) + '01';

  const { data: milkSummaryData, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['dashboard', 'milk-summary', today],
    queryFn: () =>
      api.get<{ totals: { planned: number; pending: number } }>(`/api/v1/orders/milk-summary?date=${today}`),
  });

  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: ['dashboard', 'revenue', monthStart, today],
    queryFn: () =>
      api.get<{ data: Array<{ revenue: number }> }>(
        `/api/v1/reports/revenue?startDate=${monthStart}&endDate=${today}&groupBy=month`,
      ),
  });

  const { data: outstandingData, isLoading: loadingOutstanding } = useQuery({
    queryKey: ['dashboard', 'outstanding'],
    queryFn: () =>
      api.get<{ data: Array<{ totalOutstanding: number }>; summary?: { totalOutstanding: number } }>(
        '/api/v1/reports/outstanding?page=1&limit=1',
      ),
  });

  const { data: customerData, isLoading: loadingCustomers } = useQuery({
    queryKey: ['dashboard', 'customers'],
    queryFn: () =>
      api.get<{ pagination: { total: number } }>('/api/v1/customers?status=active&page=1&limit=1'),
  });

  const { data: gpsData } = useQuery({
    queryKey: ['dashboard', 'live-gps'],
    queryFn: () => api.get<{ data: { activeVehicles: number; generatedAt: string } }>('/api/v1/delivery/location/live?minutes=30'),
    enabled: user?.role === 'super_admin',
    refetchInterval: 30000,
  });

  const loading = loadingDeliveries || loadingRevenue || loadingOutstanding || loadingCustomers;

  // Parse delivery summary
  const todayDeliveries = milkSummaryData?.totals?.planned ?? 0;
  const pendingDeliveries = milkSummaryData?.totals?.pending ?? 0;

  // Parse revenue
  const monthRevenue = revenueData?.data?.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0) ?? 0;

  // Parse outstanding — sum all outstanding amounts
  const outstandingPayments =
    Number(outstandingData?.summary?.totalOutstanding ?? 0) ||
    (outstandingData?.data?.reduce((sum, row) => sum + Number(row.totalOutstanding ?? 0), 0) ?? 0);

  const activeCustomers = customerData?.pagination?.total ?? 0;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Dashboard</h1>

      {loading && (
        <p className="text-sm text-gray-500 mb-4">Loading dashboard data…</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Today's Deliveries" value={todayDeliveries} />
        <StatCard label="Pending Deliveries" value={pendingDeliveries} />
        <StatCard label="Revenue This Month" value={monthRevenue} format="currency" />
        <StatCard label="Outstanding Payments" value={outstandingPayments} format="currency" />
        <StatCard label="Active Customers" value={activeCustomers} />
      </div>

      {user?.role === 'super_admin' && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Live GPS Tracking</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {gpsData?.data?.activeVehicles ?? 0} vehicle(s) active
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Updated: {gpsData?.data?.generatedAt ? new Date(gpsData.data.generatedAt).toLocaleTimeString() : '—'}
              </p>
            </div>
            <Link
              to="/tracking/live-gps"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open Live GPS
            </Link>
          </div>
        </div>
      )}

      <HandoverSection />
    </div>
  );
}

function rollingWeekDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

function HandoverSection() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newNote, setNewNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const weekDates = rollingWeekDates();

  const { data: handoverData, isLoading } = useQuery({
    queryKey: ['handover-notes', weekDates[0], weekDates[6]],
    queryFn: () => api.get<HandoverResponse>(`/api/v1/handover?startDate=${weekDates[0]}&endDate=${weekDates[6]}`),
  });

  const createMutation = useMutation({
    mutationFn: (data: { noteDate: string; content: string }) => api.post('/api/v1/handover', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handover-notes'] });
      setNewNote('');
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/handover/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['handover-notes'] }),
  });

  const notesByDate = new Map<string, HandoverNote[]>();
  for (const note of handoverData?.notes ?? []) {
    const dateKey = note.noteDate.slice(0, 10);
    const list = notesByDate.get(dateKey) ?? [];
    list.push(note);
    notesByDate.set(dateKey, list);
  }

  const selectedNotes = notesByDate.get(selectedDate) ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    createMutation.mutate({ noteDate: selectedDate, content: newNote.trim() });
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Handover Notes</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Note'}
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
        {weekDates.map((date) => {
          const count = notesByDate.get(date)?.length ?? 0;
          const active = date === selectedDate;
          const today = isToday(date);
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={`flex-shrink-0 rounded-lg px-3 py-2 text-center text-xs transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : today
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="font-medium">{formatShortDate(date)}</div>
              {count > 0 && (
                <div className={`mt-0.5 text-[10px] ${active ? 'text-blue-100' : 'text-gray-500'}`}>
                  {count} note{count !== 1 ? 's' : ''}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500 mb-2">Adding note for {formatShortDate(selectedDate)}</p>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write your handover note..."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending || !newNote.trim()}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading notes...</p>}

      {!isLoading && selectedNotes.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">No handover notes for {formatShortDate(selectedDate)}</p>
      )}

      <div className="space-y-3">
        {selectedNotes.map((note) => (
          <div key={note.id} className="rounded-md border border-gray-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-gray-900 whitespace-pre-wrap flex-1">{note.content}</p>
              <button
                type="button"
                onClick={() => { if (window.confirm('Delete this note?')) deleteMutation.mutate(note.id); }}
                disabled={deleteMutation.isPending}
                className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {note.creator.name} · {new Date(note.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
