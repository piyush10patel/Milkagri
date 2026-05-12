import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';
import { FileText, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';

interface Invoice {
  id: string;
  customer: { id: string; name: string };
  billingCycleStart: string;
  billingCycleEnd: string;
  version: number;
  totalCharges: number;
  totalDiscounts: number;
  totalAdjustments: number;
  totalPayments: number;
  closingBalance: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  generatedAt: string;
}

interface ListResponse {
  data: Invoice[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const statusMeta: Record<string, { variant: 'danger' | 'warning' | 'success'; label: string }> = {
  unpaid: { variant: 'danger', label: 'Unpaid' },
  partial: { variant: 'warning', label: 'Partial' },
  paid: { variant: 'success', label: 'Paid' },
};

function fmt(amount: number) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function InvoiceListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({ cycleStart: '', cycleEnd: '' });
  const [generateError, setGenerateError] = useState('');
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (statusFilter) params.set('paymentStatus', statusFilter);
  if (cycleFilter) {
    const [year, month] = cycleFilter.split('-');
    if (year && month) {
      const start = `${year}-${month}-01`;
      const end = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
      params.set('cycleStart', start);
      params.set('cycleEnd', end);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, statusFilter, customerSearch, cycleFilter],
    queryFn: () => api.get<ListResponse>(`/api/v1/billing/invoices?${params}`),
  });

  const generateMutation = useMutation({
    mutationFn: (payload: { cycleStart: string; cycleEnd: string }) =>
      api.post<{ invoicesCreated: number }>('/api/v1/billing/generate', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowGenerateModal(false);
      setGenerateForm({ cycleStart: '', cycleEnd: '' });
      setGenerateError('');
    },
    onError: (err: { message?: string }) => {
      setGenerateError(err.message ?? 'Failed to generate invoices');
    },
  });

  const filteredInvoices = data?.data?.filter((inv) =>
    customerSearch
      ? inv.customer.name.toLowerCase().includes(customerSearch.toLowerCase())
      : true,
  ) ?? [];

  const columns: Column<Invoice>[] = [
    { key: 'customer', label: 'Customer', render: (row) => <span className="font-medium text-neutral-900">{row.customer.name}</span> },
    { key: 'billingCycleStart', label: 'Billing Period', render: (row) => <span className="text-neutral-600 text-xs">{row.billingCycleStart} — {row.billingCycleEnd}</span> },
    { key: 'totalCharges', label: 'Charges', align: 'right', format: (v) => fmt(Number(v)) },
    { key: 'closingBalance', label: 'Balance', align: 'right', render: (row) => <span className={`font-semibold ${Number(row.closingBalance) > 0 ? 'text-danger-600' : 'text-success-600'}`}>{fmt(row.closingBalance)}</span> },
    { key: 'paymentStatus', label: 'Status', render: (row) => {
      const meta = statusMeta[row.paymentStatus] ?? { variant: 'neutral' as const, label: row.paymentStatus };
      return <Badge variant={meta.variant} dot>{meta.label}</Badge>;
    }},
    { key: 'actions', label: 'Actions', align: 'right', sortable: false, render: (row) => (
      <Link to={`/billing/${row.id}`}>
        <Button variant="ghost" size="sm">View</Button>
      </Link>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Manage billing cycles and customer invoices"
        actions={
          <Button size="sm" onClick={() => setShowGenerateModal(true)}>
            <FileText className="h-3.5 w-3.5" />
            Generate Invoices
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 p-4 pb-2">
          <input
            type="text"
            placeholder="Search customer..."
            value={customerSearch}
            onChange={(e) => { setCustomerSearch(e.target.value); setPage(1); }}
            className="block w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
          >
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
          <input
            type="month"
            value={cycleFilter}
            onChange={(e) => { setCycleFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
          />
        </div>

        <DataTable
          columns={columns}
          data={filteredInvoices}
          loading={isLoading}
          emptyTitle="No invoices found"
          emptyDescription={customerSearch || statusFilter ? 'Try adjusting your filters.' : 'Generate invoices to get started.'}
          pageSize={limit}
        />
      </Card>

      <Modal open={showGenerateModal} onClose={() => { setShowGenerateModal(false); setGenerateError(''); }} title="Generate Invoices" description="Select the billing cycle period for invoice generation.">
        <form onSubmit={(e) => { e.preventDefault(); setGenerateError(''); generateMutation.mutate(generateForm); }} className="space-y-4">
          <Input label="Cycle Start" type="date" value={generateForm.cycleStart} onChange={(e) => setGenerateForm((f) => ({ ...f, cycleStart: e.target.value }))} required />
          <Input label="Cycle End" type="date" value={generateForm.cycleEnd} onChange={(e) => setGenerateForm((f) => ({ ...f, cycleEnd: e.target.value }))} required />
          {generateError && <p className="text-sm text-danger-600">{generateError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowGenerateModal(false); setGenerateError(''); }}>Cancel</Button>
            <Button type="submit" loading={generateMutation.isPending}>Generate</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
