import ReportPage from './ReportPage';

const COLUMNS = [
  { key: 'product_name', label: 'Product' },
  { key: 'variant_label', label: 'Variant' },
  { key: 'total_quantity', label: 'Qty Delivered', align: 'right' as const },
  { key: 'delivery_count', label: 'Deliveries', align: 'right' as const },
];

export default function DailyDeliveryReportPage() {
  return <ReportPage title="Daily Delivery Report" endpoint="daily-delivery" columns={COLUMNS} />;
}
