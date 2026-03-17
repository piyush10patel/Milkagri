import ReportPage from './ReportPage';

const COLUMNS = [
  { key: 'delivery_date', label: 'Date' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'product_name', label: 'Product' },
  { key: 'status', label: 'Status' },
  { key: 'skip_reason', label: 'Reason' },
  { key: 'route_name', label: 'Route' },
];

export default function MissedDeliveriesReportPage() {
  return <ReportPage title="Missed Deliveries Report" endpoint="missed-deliveries" columns={COLUMNS} />;
}
