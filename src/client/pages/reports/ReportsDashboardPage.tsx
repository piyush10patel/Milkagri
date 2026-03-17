import { Link } from 'react-router-dom';

const REPORTS = [
  { key: 'daily-delivery', label: 'Daily Delivery', description: 'Total quantities delivered, grouped by product variant' },
  { key: 'route-delivery', label: 'Route Delivery', description: 'Delivery counts and statuses per route' },
  { key: 'outstanding', label: 'Customer Outstanding', description: 'Customers with unpaid balances and invoice aging' },
  { key: 'revenue', label: 'Revenue', description: 'Total billed revenue by day, week, or month' },
  { key: 'product-sales', label: 'Product Sales', description: 'Total quantities delivered per product variant' },
  { key: 'missed-deliveries', label: 'Missed Deliveries', description: 'Skipped or failed deliveries with reasons' },
  { key: 'subscription-changes', label: 'Subscription Changes', description: 'Subscription modifications audit trail' },
];

export default function ReportsDashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Reports</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Link
            key={r.key}
            to={`/reports/${r.key}`}
            className="block bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <h2 className="text-sm font-semibold text-gray-900">{r.label}</h2>
            <p className="mt-1 text-xs text-gray-500">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
