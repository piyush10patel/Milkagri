import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';
import { motion } from 'framer-motion';
import { Plus, Search, RotateCcw, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { PageLoader } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: 'active' | 'paused' | 'stopped';
  route?: { id: string; name: string };
  createdAt: string;
}

interface ListResponse {
  data: Customer[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function CustomerListPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: string } | null>(null);
  const closeConfirm = useCallback(() => setConfirmAction(null), []);
  const { modalRef: confirmModalRef } = useModalFocusTrap(!!confirmAction, closeConfirm);
  const [showResetModal, setShowResetModal] = useState(false);
  const closeResetModal = useCallback(() => setShowResetModal(false), []);
  const { modalRef: resetModalRef } = useModalFocusTrap(showResetModal, closeResetModal);
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortOrder });
  if (search) params.set('search', search);
  if (statusFilter) params.set('status', statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, statusFilter, sortBy, sortOrder],
    queryFn: () => api.get<ListResponse>(`/api/v1/customers?${params}`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/customers/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setConfirmAction(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => api.post('/api/v1/customers/reset-operational-data'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      setShowResetModal(false);
    },
  });

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      label: 'Customer',
      render: (row) => (
        <Link to={`/customers/${row.id}`} className="font-medium text-primary-600 hover:text-primary-700 transition-colors">
          {row.name}
        </Link>
      ),
    },
    { key: 'phone', label: 'Phone' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'route',
      label: 'Route',
      render: (row) => <span className="text-neutral-600">{row.route?.name ?? '—'}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Link to={`/customers/${row.id}/edit`}>
            <Button variant="ghost" size="sm">Edit</Button>
          </Link>
          {row.status === 'active' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ id: row.id, status: 'paused' })}>Pause</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmAction({ id: row.id, status: 'stopped' })} className="text-danger-600 hover:text-danger-700">Stop</Button>
            </>
          )}
          {row.status === 'paused' && (
            <Button variant="ghost" size="sm" className="text-success-600" onClick={() => setConfirmAction({ id: row.id, status: 'active' })}>Reactivate</Button>
          )}
          {row.status === 'stopped' && (
            <Button variant="ghost" size="sm" className="text-success-600" onClick={() => setConfirmAction({ id: row.id, status: 'active' })}>Reactivate</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${data?.pagination?.total ?? 0} total customers`}
        actions={
          <>
            {(user?.role === 'super_admin' || user?.role === 'admin') && (
              <Button variant="secondary" size="sm" onClick={() => setShowResetModal(true)}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Data
              </Button>
            )}
            <Link to="/customers/new">
              <Button size="sm">
                <UserPlus className="h-3.5 w-3.5" />
                New Customer
              </Button>
            </Link>
          </>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          searchable
          searchPlaceholder="Search by name, phone..."
          emptyTitle="No customers found"
          emptyDescription={search || statusFilter ? 'Try adjusting your search or filters.' : 'Get started by adding your first customer.'}
          emptyAction={!search && !statusFilter ? <Link to="/customers/new"><Button size="sm"><Plus className="h-3.5 w-3.5" /> Add Customer</Button></Link> : undefined}
          pageSize={limit}
        />
      </Card>

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" role="dialog" aria-modal="true">
          <div ref={confirmModalRef} className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-modal animate-scale-in">
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Confirm Status Change</h2>
            <p className="text-sm text-neutral-600 mb-4">
              Change status to <Badge variant={confirmAction.status === 'active' ? 'success' : confirmAction.status === 'paused' ? 'warning' : 'danger'}>{confirmAction.status}</Badge>?
              {confirmAction.status === 'paused' && ' All active subscriptions will be suspended.'}
              {confirmAction.status === 'stopped' && ' All active subscriptions will be cancelled.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeConfirm}>Cancel</Button>
              <Button size="sm" onClick={() => statusMutation.mutate(confirmAction)} loading={statusMutation.isPending}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in" role="dialog" aria-modal="true">
          <div ref={resetModalRef} className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-modal animate-scale-in">
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Reset Operational Data</h2>
            <p className="text-sm text-neutral-600 mb-4">
              This will permanently remove customers, subscriptions, orders, invoices, payments, ledger entries, and related history. Users, products, pricing, and routes will remain.
            </p>
            {resetMutation.isError && (
              <p className="mb-3 text-sm text-danger-600">Reset failed. Please try again.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeResetModal}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => resetMutation.mutate()} loading={resetMutation.isPending}>Reset Now</Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
