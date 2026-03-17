import { useState } from 'react';
import ReportPage from './ReportPage';

const currency = (v: unknown) => v == null ? '—' : `₹${Number(v).toFixed(2)}`;

const COLUMNS = [
  { key: 'period', label: 'Period' },
  { key: 'total_revenue', label: 'Revenue', align: 'right' as const, format: currency },
  { key: 'invoice_count', label: 'Invoices', align: 'right' as const },
];

export default function RevenueReportPage() {
  const [groupBy, setGroupBy] = useState('month');

  return (
    <ReportPage
      title="Revenue Report"
      endpoint="revenue"
      columns={COLUMNS}
      extraParams={{ groupBy }}
      renderFilters={({ setExtra }) => (
        <select
          value={groupBy}
          onChange={(e) => { setGroupBy(e.target.value); setExtra('groupBy', e.target.value); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Group by"
        >
          <option value="day">By Day</option>
          <option value="week">By Week</option>
          <option value="month">By Month</option>
        </select>
      )}
    />
  );
}
