import ReportPage from './ReportPage';

const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString() : '—');

const COLUMNS = [
  { key: 'deliveryDate', label: 'Date', format: formatDate },
  { key: 'customer.name', label: 'Customer' },
  { key: 'productName', label: 'Product' },
  { key: 'status', label: 'Status' },
  { key: 'skipReason', label: 'Skip Reason' },
  { key: 'failureReason', label: 'Failure Reason' },
  { key: 'route.name', label: 'Route' },
];

export default function MissedDeliveriesReportPage() {
  return <ReportPage title="Missed Deliveries Report" endpoint="missed-deliveries" columns={COLUMNS} />;
}
