import ReportPage from './ReportPage';

const currency = (v: unknown) => v == null ? '—' : `₹${Number(v).toFixed(2)}`;
const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString() : '—');

const COLUMNS = [
  { key: 'customerName', label: 'Customer' },
  { key: 'phone', label: 'Phone' },
  { key: 'totalOutstanding', label: 'Outstanding', align: 'right' as const, format: currency },
  { key: 'invoiceCount', label: 'Invoices', align: 'right' as const },
  { key: 'oldestInvoiceDate', label: 'Oldest Unpaid', format: formatDate },
  { key: 'agingDays', label: 'Aging (days)', align: 'right' as const },
];

export default function OutstandingReportPage() {
  return <ReportPage title="Customer Outstanding Report" endpoint="outstanding" columns={COLUMNS} useDateRange={false} />;
}
