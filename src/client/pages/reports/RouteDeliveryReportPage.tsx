import ReportPage from './ReportPage';

const COLUMNS = [
  { key: 'route_name', label: 'Route' },
  { key: 'delivered', label: 'Delivered', align: 'right' as const },
  { key: 'skipped', label: 'Skipped', align: 'right' as const },
  { key: 'failed', label: 'Failed', align: 'right' as const },
  { key: 'returned', label: 'Returned', align: 'right' as const },
  { key: 'total', label: 'Total', align: 'right' as const },
];

export default function RouteDeliveryReportPage() {
  return <ReportPage title="Route Delivery Report" endpoint="route-delivery" columns={COLUMNS} />;
}
