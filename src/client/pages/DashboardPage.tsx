import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  const { data: deliveryData, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['dashboard', 'deliveries', today],
    queryFn: () => api.get<{ data: Array<{ status: string; _count: number }> }>(`/api/v1/orders/summary?date=${today}`),
  });

  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: ['dashboard', 'revenue', monthStart, today],
    queryFn: () =>
      api.get<{ data: Array<{ total_revenue: number }> }>(
        `/api/v1/reports/revenue?start_date=${monthStart}&end_date=${today}&group_by=month`,
      ),
  });

  const { data: outstandingData, isLoading: loadingOutstanding } = useQuery({
    queryKey: ['dashboard', 'outstanding'],
    queryFn: () =>
      api.get<{ data: Array<{ outstanding_amount: number }> }>('/api/v1/reports/outstanding?page=1&limit=1'),
  });

  const { data: customerData, isLoading: loadingCustomers } = useQuery({
    queryKey: ['dashboard', 'customers'],
    queryFn: () =>
      api.get<{ pagination: { total: number } }>('/api/v1/customers?status=active&page=1&limit=1'),
  });

  const loading = loadingDeliveries || loadingRevenue || loadingOutstanding || loadingCustomers;

  // Parse delivery summary
  let todayDeliveries = 0;
  let pendingDeliveries = 0;
  if (deliveryData?.data) {
    for (const row of deliveryData.data) {
      todayDeliveries += row._count ?? 0;
      if (row.status === 'pending') pendingDeliveries += row._count ?? 0;
    }
  }

  // Parse revenue
  const monthRevenue = revenueData?.data?.[0]?.total_revenue ?? 0;

  // Parse outstanding — sum all outstanding amounts
  let outstandingPayments = 0;
  if (outstandingData?.data) {
    for (const row of outstandingData.data) {
      outstandingPayments += row.outstanding_amount ?? 0;
    }
  }

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
    </div>
  );
}
