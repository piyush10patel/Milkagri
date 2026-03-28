import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';

interface DashboardStats {
  todayDeliveries: number;
  pendingDeliveries: number;
  monthRevenue: number;
  outstandingPayments: number;
  activeCustomers: number;
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
    </div>
  );
}
