import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  Truck,
  Clock,
  IndianRupee,
  AlertCircle,
  Users,
  Navigation,
  Calendar,
  Plus,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Activity,
  TrendingUp,
  MapPin,
  ClipboardList,
  BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';

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

interface AgentCollectionDashboardResponse {
  date: string;
  deliveryRoutes: Array<{ id: string; name: string }>;
  collectionRoutes: Array<{
    id: string;
    name: string;
    villages: Array<{
      villageId: string;
      villageName: string;
      deliverySession: 'morning' | 'evening';
      farmers: Array<{ id: string; name: string }>;
    }>;
  }>;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardPage() {
  const { user } = useAuth();
  const now = new Date();
  const pad2 = (value: number) => String(value).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const monthStart = today.slice(0, 8) + '01';

  const { data: milkSummaryData } = useQuery({
    queryKey: ['dashboard', 'milk-summary', today],
    queryFn: () =>
      api.get<{ totals: { planned: number; pending: number } }>(`/api/v1/orders/milk-summary?date=${today}`),
  });

  const { data: revenueData } = useQuery({
    queryKey: ['dashboard', 'revenue', monthStart, today],
    queryFn: () =>
      api.get<{ data: Array<{ revenue: number }> }>(
        `/api/v1/reports/revenue?startDate=${monthStart}&endDate=${today}&groupBy=month`,
      ),
  });

  const { data: outstandingData } = useQuery({
    queryKey: ['dashboard', 'outstanding'],
    queryFn: () =>
      api.get<{ data: Array<{ totalOutstanding: number }>; summary?: { totalOutstanding: number } }>(
        '/api/v1/reports/outstanding?page=1&limit=1',
      ),
  });

  const { data: customerData } = useQuery({
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

  const { data: agentDashboardData } = useQuery({
    queryKey: ['agent-collection-dashboard', today],
    queryFn: () => api.get<AgentCollectionDashboardResponse>(`/api/v1/milk-collections/agent-dashboard?date=${today}`),
    enabled: user?.role === 'delivery_agent',
  });

  const todayDeliveries = milkSummaryData?.totals?.planned ?? 0;
  const pendingDeliveries = milkSummaryData?.totals?.pending ?? 0;
  const monthRevenue = revenueData?.data?.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0) ?? 0;
  const outstandingPayments =
    Number(outstandingData?.summary?.totalOutstanding ?? 0) ||
    (outstandingData?.data?.reduce((sum, row) => sum + Number(row.totalOutstanding ?? 0), 0) ?? 0);
  const activeCustomers = customerData?.pagination?.total ?? 0;

  const isLoading = false; // hero zero

  const chartData = [
    { name: 'Mon', deliveries: 42, revenue: 24000 },
    { name: 'Tue', deliveries: 38, revenue: 22100 },
    { name: 'Wed', deliveries: 45, revenue: 26800 },
    { name: 'Thu', deliveries: 40, revenue: 23500 },
    { name: 'Fri', deliveries: 48, revenue: 28100 },
    { name: 'Sat', deliveries: 35, revenue: 21000 },
    { name: 'Sun', deliveries: 30, revenue: 18500 },
  ];

  const pieData = [
    { name: 'Morning', value: 65 },
    { name: 'Evening', value: 35 },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title={`Good ${now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening'}, ${user?.name?.split(' ')[0] ?? 'User'}`}
          description={`Here's your overview for ${today}`}
        />
      </motion.div>

      {user?.role === 'delivery_agent' && (
        <motion.div variants={item}>
          <AgentWorkPanel today={today} data={agentDashboardData} />
        </motion.div>
      )}

      {/* KPI Cards */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard label="Today's Deliveries" value={todayDeliveries.toLocaleString('en-IN')} loading={isLoading} icon={<Truck className="h-4 w-4" />} />
        <KpiCard label="Pending" value={pendingDeliveries.toLocaleString('en-IN')} loading={isLoading} icon={<Clock className="h-4 w-4" />} trend={{ value: 12, positive: false }} />
        <KpiCard label="Revenue This Month" value={`₹${monthRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} loading={isLoading} icon={<IndianRupee className="h-4 w-4" />} trend={{ value: 8, positive: true }} />
        <KpiCard label="Outstanding" value={`₹${outstandingPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} loading={isLoading} icon={<AlertCircle className="h-4 w-4" />} trend={{ value: 5, positive: false }} />
        <KpiCard label="Active Customers" value={activeCustomers.toLocaleString('en-IN')} loading={isLoading} icon={<Users className="h-4 w-4" />} trend={{ value: 3, positive: true }} />
      </motion.div>

      {/* Charts Row */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Weekly Overview</h2>
                <p className="text-xs text-neutral-500">Delivery and revenue trends</p>
              </div>
              <Badge variant="info" size="sm">
                <TrendingUp className="h-3 w-3 mr-1" /> +12%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      fontSize: '13px',
                    }}
                  />
                  <Bar dataKey="deliveries" fill="#2563eb" radius={[4, 4, 0, 0]} name="Deliveries" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Session Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Session Split</h2>
                <p className="text-xs text-neutral-500">Delivery distribution</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index] }} />
                  <span className="text-xs text-neutral-600">{entry.name} ({entry.value}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* GPS + Handover */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {user?.role === 'super_admin' && gpsData && (
          <Card hover>
            <CardContent>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-primary-50 p-3">
                    <MapPin className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">Live GPS Tracking</p>
                    <p className="mt-1 text-2xl font-semibold text-neutral-900">
                      {gpsData?.data?.activeVehicles ?? 0}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      vehicle{gpsData?.data?.activeVehicles !== 1 ? 's' : ''} active on road
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Last updated: {gpsData?.data?.generatedAt ? new Date(gpsData.data.generatedAt).toLocaleTimeString() : '—'}
                    </p>
                  </div>
                </div>
                <Link to="/tracking/live-gps">
                  <Button variant="secondary" size="sm">
                    <Navigation className="h-3.5 w-3.5" />
                    View Map
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card hover>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-success-50 p-3">
                <Activity className="h-6 w-6 text-success-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-900 mb-3">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/orders">
                    <Button variant="secondary" size="sm" className="w-full">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Orders
                    </Button>
                  </Link>
                  <Link to="/deliveries">
                    <Button variant="secondary" size="sm" className="w-full">
                      <Truck className="h-3.5 w-3.5" />
                      Deliveries
                    </Button>
                  </Link>
                  <Link to="/billing">
                    <Button variant="secondary" size="sm" className="w-full">
                      <IndianRupee className="h-3.5 w-3.5" />
                      Billing
                    </Button>
                  </Link>
                  <Link to="/reports">
                    <Button variant="secondary" size="sm" className="w-full">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Reports
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Handover Notes for Admin+ */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <motion.div variants={item}>
          <HandoverSection />
        </motion.div>
      )}
    </motion.div>
  );
}

function AgentWorkPanel({ today, data }: { today: string; data: AgentCollectionDashboardResponse | undefined }) {
  const queryClient = useQueryClient();
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>('morning');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');

  const assignedStops = (data?.collectionRoutes ?? []).flatMap((route) => route.villages);
  const villageOptions = Array.from(new Map(assignedStops.map((stop) => [stop.villageId, { id: stop.villageId, name: stop.villageName }])).values());
  const selectedStop = assignedStops.find((stop) => stop.villageId === selectedVillageId && stop.deliverySession === selectedSession);
  const farmerOptions = selectedStop?.farmers ?? [];

  const saveMutation = useMutation({
    mutationFn: (body: { villageId: string; farmerId: string; collectionDate: string; deliverySession: 'morning' | 'evening'; quantity: number }) =>
      api.post('/api/v1/milk-collections', body),
    onSuccess: () => {
      setQuantity('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['agent-collection-dashboard'] });
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to save milk collection');
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 p-2.5">
            <ClipboardList className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">My Assigned Work</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Delivery routes: {(data?.deliveryRoutes ?? []).map((route) => route.name).join(', ') || 'None assigned'}
            </p>
            <p className="text-xs text-neutral-500">
              Collection routes: {(data?.collectionRoutes ?? []).map((route) => route.name).join(', ') || 'None assigned'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedVillageId || !selectedFarmerId || !quantity) return;
            saveMutation.mutate({
              villageId: selectedVillageId,
              farmerId: selectedFarmerId,
              collectionDate: today,
              deliverySession: selectedSession,
              quantity: Number(quantity),
            });
          }}
        >
          <div className="min-w-[160px] flex-1">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Village</label>
            <select
              value={selectedVillageId}
              onChange={(e) => { setSelectedVillageId(e.target.value); setSelectedFarmerId(''); }}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
              required
            >
              <option value="">Select village</option>
              {villageOptions.map((village) => <option key={village.id} value={village.id}>{village.name}</option>)}
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Session</label>
            <select
              value={selectedSession}
              onChange={(e) => { setSelectedSession(e.target.value as 'morning' | 'evening'); setSelectedFarmerId(''); }}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Farmer</label>
            <select
              value={selectedFarmerId}
              onChange={(e) => setSelectedFarmerId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
              required
            >
              <option value="">{selectedStop ? 'Select farmer' : 'No farmer'}</option>
              {farmerOptions.map((farmer) => <option key={farmer.id} value={farmer.id}>{farmer.name}</option>)}
            </select>
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Liters</label>
            <input
              type="number" min="0.001" step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.000"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
              required
            />
          </div>
          <div className="pb-px">
            <Button type="submit" loading={saveMutation.isPending} size="md">
              <Plus className="h-3.5 w-3.5" />
              Save Milk
            </Button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

function rollingWeekDates(offset: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  const base = offset * 7;
  for (let i = base - 3; i <= base + 3; i++) {
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const weekDates = rollingWeekDates(weekOffset);

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

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api.put(`/api/v1/handover/${id}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handover-notes'] });
      setEditingId(null);
      setEditContent('');
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2.5">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Handover Notes</h2>
              <p className="text-xs text-neutral-500">Shift handover communication</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : <><Plus className="h-3.5 w-3.5" /> Add Note</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week navigation */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
            >
              Today
            </button>
          )}
          <div className="flex-1 flex gap-1 overflow-x-auto">
            {weekDates.map((date) => {
              const count = notesByDate.get(date)?.length ?? 0;
              const active = date === selectedDate;
              const today = isToday(date);
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`flex-shrink-0 rounded-lg px-3 py-2 text-center text-xs transition-all ${
                    active
                      ? 'bg-primary-500 text-white shadow-soft'
                      : today
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 border border-transparent'
                  }`}
                >
                  <div className="font-medium">{formatShortDate(date)}</div>
                  {count > 0 && (
                    <div className={`mt-0.5 text-[10px] ${active ? 'text-primary-100' : 'text-neutral-400'}`}>
                      {count} note{count !== 1 ? 's' : ''}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newNote.trim()) return;
              createMutation.mutate({ noteDate: selectedDate, content: newNote.trim() });
            }}
            className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-neutral-400" />
              <span className="text-xs text-neutral-600">Adding note for <strong>{formatShortDate(selectedDate)}</strong></span>
            </div>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write your handover note..."
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
              required
            />
            <div className="flex justify-end">
              <Button type="submit" loading={createMutation.isPending} disabled={!newNote.trim()} size="sm">
                Save Note
              </Button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-sm text-neutral-500 text-center py-8">Loading notes...</p>}

        {!isLoading && selectedNotes.length === 0 && (
          <EmptyState
            title="No handover notes"
            description={`No notes for ${formatShortDate(selectedDate)}`}
          />
        )}

        <div className="space-y-3">
          {selectedNotes.map((note) => (
            <div key={note.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              {editingId === note.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editingId || !editContent.trim()) return;
                    updateMutation.mutate({ id: editingId, content: editContent.trim() });
                  }}
                  className="space-y-3"
                >
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                    required
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button type="submit" loading={updateMutation.isPending} size="sm">Save</Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-neutral-900 whitespace-pre-wrap flex-1 leading-relaxed">{note.content}</p>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                        className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (window.confirm('Delete this note?')) deleteMutation.mutate(note.id); }}
                        disabled={deleteMutation.isPending}
                        className="rounded-lg p-1.5 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-5 w-5 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-semibold text-primary-700">
                      {note.creator.name.charAt(0)}
                    </div>
                    <p className="text-xs text-neutral-400">
                      {note.creator.name} · {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
