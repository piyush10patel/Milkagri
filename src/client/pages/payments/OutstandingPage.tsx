import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { DollarSign, History, Plus, Receipt } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

interface OutstandingCustomer {
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  totalOutstanding: number;
  invoiceCount: number;
  oldestUnpaidDate?: string;
}

interface ReconciliationEntry {
  agent: {
    id: string;
    name: string;
  };
  totalCollected: number;
  collectionCount: number;
}

interface ListResponse {
  data: OutstandingCustomer[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function fmt(amount: number) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function OutstandingPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'totalOutstanding'>('totalOutstanding');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconDate, setReconDate] = useState(() => new Date().toISOString().slice(0, 10));
  const limit = 20;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy: sortBy === 'totalOutstanding' ? 'outstanding' : 'name',
    sortOrder,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['outstanding', page, sortBy, sortOrder],
    queryFn: () => api.get<ListResponse>(`/api/v1/payments/outstanding?${params}`),
  });

  const { data: reconData } = useQuery({
    queryKey: ['payment-reconciliation', reconDate],
    queryFn: () => api.get<{ agents: ReconciliationEntry[]; grandTotal: number }>(`/api/v1/payments/reconciliation?date=${reconDate}`),
    enabled: showReconciliation,
  });

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const columns: Column<OutstandingCustomer>[] = [
    { key: 'customer', label: 'Customer', render: (row) => (
      <Link to={`/customers/${row.customer.id}`} className="font-medium text-primary-600 hover:text-primary-700 transition-colors">
        {row.customer.name}
      </Link>
    )},
    { key: 'phone', label: 'Phone', render: (row) => <span className="text-neutral-600">{row.customer.phone}</span> },
    { key: 'totalOutstanding', label: 'Outstanding', align: 'right', render: (row) => (
      <span className="font-semibold text-danger-600">{fmt(row.totalOutstanding)}</span>
    )},
    { key: 'invoiceCount', label: 'Invoices', align: 'right' },
    { key: 'oldestUnpaidDate', label: 'Oldest Unpaid', render: (row) => <span className="text-neutral-600">{row.oldestUnpaidDate ?? '—'}</span> },
    { key: 'actions', label: 'Actions', align: 'right', sortable: false, render: (row) => (
      <Link to={`/payments/new?customerId=${row.customer.id}`}>
        <Button variant="secondary" size="sm">
          <DollarSign className="h-3 w-3" />
          Pay
        </Button>
      </Link>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Outstanding Payments"
        description="Track and manage customer payment collections"
        actions={
          <>
            <Link to="/payments/history">
              <Button variant="secondary" size="sm">
                <History className="h-3.5 w-3.5" />
                History
              </Button>
            </Link>
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={() => setShowReconciliation(!showReconciliation)}>
                <Receipt className="h-3.5 w-3.5" />
                Reconciliation
              </Button>
            )}
            <Link to="/payments/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" />
                Record Payment
              </Button>
            </Link>
          </>
        }
      />

      {/* Collection Reconciliation (Admin only) */}
      {showReconciliation && isAdmin && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900">Collection Reconciliation</h2>
                <input
                  type="date"
                  value={reconDate}
                  onChange={(e) => setReconDate(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                />
              </div>
            </CardHeader>
            <CardContent>
              {reconData?.agents?.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-100 text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase">Agent</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-500 uppercase">Collected</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-500 uppercase">Collections</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {reconData.agents.map((r) => (
                        <tr key={r.agent.id} className="hover:bg-neutral-50">
                          <td className="px-3 py-2.5 font-medium text-neutral-900">{r.agent.name}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-neutral-900">{fmt(r.totalCollected)}</td>
                          <td className="px-3 py-2.5 text-right text-neutral-600">{r.collectionCount}</td>
                        </tr>
                      ))}
                      <tr className="bg-neutral-50 font-semibold">
                        <td className="px-3 py-2.5 text-neutral-900">Grand Total</td>
                        <td className="px-3 py-2.5 text-right text-neutral-900">{fmt(reconData.grandTotal)}</td>
                        <td className="px-3 py-2.5 text-right text-neutral-900">{reconData.agents.reduce((s, r) => s + r.collectionCount, 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No reconciliation data" description="No collection data for this date" />
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          searchable
          searchPlaceholder="Search customers..."
          emptyTitle="No outstanding payments"
          emptyDescription="All customer invoices have been paid."
          pageSize={limit}
        />
      </Card>
    </motion.div>
  );
}
