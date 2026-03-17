import ReportPage from './ReportPage';

const COLUMNS = [
  { key: 'product_name', label: 'Product' },
  { key: 'variant_label', label: 'Variant' },
  { key: 'total_quantity', label: 'Qty Sold', align: 'right' as const },
  { key: 'delivery_count', label: 'Deliveries', align: 'right' as const },
];

export default function ProductSalesReportPage() {
  return <ReportPage title="Product Sales Report" endpoint="product-sales" columns={COLUMNS} />;
}
