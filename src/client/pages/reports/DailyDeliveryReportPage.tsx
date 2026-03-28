import ReportPage from './ReportPage';

const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString() : '—');

const COLUMNS = [
  { key: 'deliveryDate', label: 'Date', format: formatDate },
  { key: 'productName', label: 'Product' },
  { key: 'quantityPerUnit', label: 'Variant', format: (_v: unknown) => _v == null ? '—' : String(_v) },
  { key: 'unitType', label: 'Unit' },
  { key: 'totalQuantity', label: 'Qty Delivered', align: 'right' as const },
  { key: 'orderCount', label: 'Deliveries', align: 'right' as const },
];

export default function DailyDeliveryReportPage() {
  return <ReportPage title="Daily Delivery Report" endpoint="daily-delivery" columns={COLUMNS} />;
}
