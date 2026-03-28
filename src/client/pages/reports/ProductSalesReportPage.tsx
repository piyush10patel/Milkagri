import ReportPage from './ReportPage';

const COLUMNS = [
  { key: 'productName', label: 'Product' },
  { key: 'quantityPerUnit', label: 'Variant', align: 'right' as const },
  { key: 'unitType', label: 'Unit' },
  { key: 'totalQuantity', label: 'Qty Sold', align: 'right' as const },
  { key: 'orderCount', label: 'Deliveries', align: 'right' as const },
];

export default function ProductSalesReportPage() {
  return <ReportPage title="Product Sales Report" endpoint="product-sales" columns={COLUMNS} />;
}
