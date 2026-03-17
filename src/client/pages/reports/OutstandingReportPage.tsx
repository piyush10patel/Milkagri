import ReportPage from './ReportPage';

const currency = (v: unknown) => v == null ? '—' : `₹${Number(v).toFixed(2)}`;

const COLUMNS = [
  { key: 'customer_name', label: 'Customer' },
  { key: 'phone', label: 'Phone' },
  { key: 'outstanding_amount', label: 'Outstanding', align: 'right' as const, format: currency },
  { key: 'last_payment_date', label: 'Last Payment' },
  { key: 'oldest_unpaid_invoice', label: 'Oldest Unpaid' },
];

export default function OutstandingReportPage() {
  return <ReportPage title="Customer Outstanding Report" endpoint="outstanding" columns={COLUMNS} useDateRange={false} />;
}
