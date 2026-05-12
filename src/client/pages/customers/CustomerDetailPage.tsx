import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Route, Tag, Calendar, Clock, FileText, Pencil, PauseCircle, PlayCircle, StopCircle, Download, History } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { PageLoader } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

interface Address { id: string; addressLine1: string; addressLine2?: string; city?: string; state?: string; pincode?: string; isPrimary: boolean; }
interface Subscription {
  id: string;
  route?: { id: string; name: string } | null;
  productVariant: { product: { name: string }; unitType: string; quantityPerUnit: number };
  quantity: number;
  deliverySession: 'morning' | 'evening';
  packs?: Array<{ packSize: number | string; packCount: number }>;
  frequencyType: string;
  status: string;
  startDate: string;
}
interface LedgerEntry { id: string; entryDate: string; transactionType: string; debitAmount: number; creditAmount: number; runningBalance: number; description?: string; }
interface CustomerDetail {
  id: string; name: string; phone: string; email?: string; status: string;
  deliveryNotes?: string; preferredDeliveryWindow?: string;
  pricingCategory?: string; billingFrequency?: string;
  route?: { id: string; name: string };
  addresses: Address[];
  createdAt: string;
}
interface PricingCategoryOption { id: string; code: string; name: string; }

function fmtDate(value?: string) { return value ? value.slice(0, 10) : '—'; }

const freqLabel: Record<string, string> = { daily: 'Daily', alternate_day: 'Alternate Day', custom_weekday: 'Custom Weekday' };
const billingFreqLabel: Record<string, string> = { daily: 'Daily', every_2_days: 'Every 2 Days', weekly: 'Weekly', every_10_days: 'Every 10 Days', monthly: 'Monthly' };

function InfoField({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-0.5">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="text-sm text-neutral-900">{value}</div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const closeConfirm = useCallback(() => setConfirmAction(null), []);

  const { data: customerData, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<{ data: CustomerDetail }>(`/api/v1/customers/${id}`),
  });

  const { data: subsData } = useQuery({
    queryKey: ['customer-subscriptions', id],
    queryFn: () => api.get<{ data: Subscription[] }>(`/api/v1/subscriptions?customerId=${id}&limit=50`),
  });

  const { data: ledgerData } = useQuery({
    queryKey: ['customer-ledger', id],
    queryFn: () => api.get<{ data: LedgerEntry[] }>(`/api/v1/customers/${id}/ledger?limit=20`),
  });

  const { data: pricingCategoriesData } = useQuery({
    queryKey: ['pricing-categories-options'],
    queryFn: () => api.get<{ data: PricingCategoryOption[] }>('/api/v1/pricing-categories'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: string }) => api.patch(`/api/v1/customers/${id}/status`, { status }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setConfirmAction(null);
      toast('success', 'Status updated', `Customer status changed to ${variables.status}`);
    },
    onError: () => {
      toast('error', 'Failed to update status');
    },
  });

  if (isLoading) return <PageLoader />;
  const c = customerData?.data;
  if (!c) return (
    <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
      <p className="text-lg font-medium">Customer not found</p>
      <Link to="/customers" className="mt-2 text-sm text-primary-600 hover:underline">Back to customers</Link>
    </div>
  );

  const pricingCategoryLabel = pricingCategoriesData?.data?.find((item) => item.code === c.pricingCategory)?.name ?? c.pricingCategory;

  const subscriptionColumns: Column<Subscription>[] = [
    { key: 'product', label: 'Product', render: (row) => (
      <span className="font-medium text-neutral-900 text-xs">{row.productVariant?.product?.name} ({row.productVariant?.quantityPerUnit} {row.productVariant?.unitType})</span>
    )},
    { key: 'quantity', label: 'Qty', align: 'right', render: (row) => (
      <div className="text-right">
        <span className="font-medium">{row.quantity}</span>
        {row.packs?.length ? <div className="text-[10px] text-neutral-400">{row.packs.map((p) => `${p.packCount}x${Number(p.packSize)}L`).join(', ')}</div> : null}
      </div>
    )},
    { key: 'deliverySession', label: 'Session', render: (row) => <StatusBadge status={row.deliverySession} /> },
    { key: 'route', label: 'Route', render: (row) => <span className="text-neutral-600">{row.route?.name ?? '—'}</span> },
    { key: 'frequencyType', label: 'Frequency', render: (row) => <span className="text-neutral-600 text-xs">{freqLabel[row.frequencyType] ?? row.frequencyType}</span> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'startDate', label: 'Start', format: (v) => fmtDate(v as string) },
  ];

  const ledgerColumns: Column<LedgerEntry>[] = [
    { key: 'entryDate', label: 'Date', render: (row) => <span className="text-neutral-600">{row.entryDate}</span> },
    { key: 'transactionType', label: 'Type', render: (row) => <span className="capitalize text-neutral-900">{row.transactionType.replace(/_/g, ' ')}</span> },
    { key: 'debitAmount', label: 'Debit', align: 'right', render: (row) => (
      <span className={cn(row.debitAmount > 0 ? 'text-danger-600' : 'text-neutral-400')}>{row.debitAmount > 0 ? `₹${row.debitAmount.toFixed(2)}` : '—'}</span>
    )},
    { key: 'creditAmount', label: 'Credit', align: 'right', render: (row) => (
      <span className={cn(row.creditAmount > 0 ? 'text-success-600' : 'text-neutral-400')}>{row.creditAmount > 0 ? `₹${row.creditAmount.toFixed(2)}` : '—'}</span>
    )},
    { key: 'runningBalance', label: 'Balance', align: 'right', render: (row) => (
      <span className="font-medium text-neutral-900">₹{row.runningBalance.toFixed(2)}</span>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title={c.name}
        breadcrumbs={[{ label: 'Customers', to: '/customers' }, { label: c.name }]}
        actions={
          <div className="flex items-center gap-2">
            <Link to={`/customers/${c.id}/edit`}>
              <Button variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            </Link>
            {c.status === 'active' && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setConfirmAction('paused')}><PauseCircle className="h-3.5 w-3.5" /> Pause</Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmAction('stopped')}><StopCircle className="h-3.5 w-3.5" /> Stop</Button>
              </>
            )}
            {(c.status === 'paused' || c.status === 'stopped') && (
              <Button variant="success" size="sm" onClick={() => setConfirmAction('active')}><PlayCircle className="h-3.5 w-3.5" /> Reactivate</Button>
            )}
          </div>
        }
      />

      {/* Customer Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-neutral-900">Customer Information</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
            <InfoField label="Phone" value={c.phone} icon={Phone} />
            <InfoField label="Email" value={c.email || '—'} icon={Mail} />
            <InfoField label="Status" value={<StatusBadge status={c.status} />} />
            <InfoField label="Route" value={c.route?.name ?? '—'} icon={Route} />
            <InfoField label="Pricing Category" value={c.pricingCategory ? pricingCategoryLabel : '—'} icon={Tag} />
            <InfoField label="Billing Frequency" value={c.billingFrequency ? billingFreqLabel[c.billingFrequency] ?? c.billingFrequency : '—'} icon={Calendar} />
            <InfoField label="Delivery Notes" value={c.deliveryNotes || '—'} icon={FileText} />
            <InfoField label="Preferred Window" value={c.preferredDeliveryWindow || '—'} icon={Clock} />
            <InfoField label="Created" value={fmtDate(c.createdAt)} icon={Calendar} />
          </div>
        </CardContent>
      </Card>

      {/* Addresses */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-neutral-900">Addresses</h2>
          </div>
        </CardHeader>
        <CardContent>
          {c.addresses?.length ? (
            <div className="space-y-3">
              {c.addresses.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 text-sm">
                  <MapPin className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    {a.isPrimary && <Badge variant="info" className="mb-1">Primary</Badge>}
                    <p className="text-neutral-900">{a.addressLine1}{a.addressLine2 ? `, ${a.addressLine2}` : ''}</p>
                    <p className="text-neutral-500 text-xs">{[a.city, a.state, a.pincode].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400 py-2">No addresses on file</p>
          )}
        </CardContent>
      </Card>

      {/* Subscriptions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-neutral-900">Subscriptions</h2>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={subscriptionColumns}
            data={subsData?.data ?? []}
            emptyTitle="No subscriptions"
            emptyDescription="This customer does not have any subscriptions."
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-neutral-500" />
              <h2 className="text-sm font-semibold text-neutral-900">Ledger (Recent)</h2>
            </div>
            <a href={`/api/v1/customers/${id}/ledger/pdf`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 transition-colors">
              <Download className="h-3 w-3" /> PDF
            </a>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={ledgerColumns}
            data={ledgerData?.data ?? []}
            emptyTitle="No ledger entries"
            emptyDescription="No transactions recorded for this customer."
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Modal open={!!confirmAction} onClose={closeConfirm} title="Confirm Status Change" description={`Change customer status to "${confirmAction}"?`} size="sm">
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={closeConfirm}>Cancel</Button>
          <Button
            onClick={() => confirmAction && statusMutation.mutate({ status: confirmAction })}
            loading={statusMutation.isPending}
            variant={confirmAction === 'stopped' ? 'danger' : confirmAction === 'active' ? 'success' : 'primary'}
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </motion.div>
  );
}
