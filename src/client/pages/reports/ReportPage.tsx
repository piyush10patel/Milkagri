import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
  format?: (v: unknown) => string;
}

interface ReportPageProps {
  title: string;
  endpoint: string;
  columns: Column[];
  /** Extra query params beyond date range */
  extraParams?: Record<string, string>;
  /** Whether this report uses date range filtering (default true) */
  useDateRange?: boolean;
  /** Extra filter controls rendered above the table */
  renderFilters?: (params: { setExtra: (k: string, v: string) => void }) => React.ReactNode;
}

interface ListResponse {
  items: Record<string, unknown>[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  data?: Record<string, unknown>[];
}

const fmt = (v: unknown) => (v == null ? '—' : String(v));

export default function ReportPage({ title, endpoint, columns, extraParams, useDateRange = true, renderFilters }: ReportPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [extra, setExtraState] = useState<Record<string, string>>(extraParams ?? {});
  const limit = 25;

  function setExtra(k: string, v: string) {
    setExtraState((prev) => ({ ...prev, [k]: v }));
    setPage(1);
  }

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (useDateRange) {
    params.set('startDate', startDate);
    params.set('endDate', endDate);
  }
  if (sortBy) { params.set('sortBy', sortBy); params.set('sortOrder', sortOrder); }
  Object.entries(extra).forEach(([k, v]) => { if (v) params.set(k, v); });

  const { data, isLoading } = useQuery({
    queryKey: ['report', endpoint, startDate, endDate, page, sortBy, sortOrder, extra],
    queryFn: () => api.get<ListResponse>(`/api/v1/reports/${endpoint}?${params}`),
  });

  const rows = data?.items ?? data?.data ?? [];
  const pagination = data?.pagination;

  function handleSort(col: string) {
    if (sortBy === col) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('asc'); }
  }

  const sortIcon = (col: string) => (sortBy === col ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '');

  function handleCsvExport() {
    const csvParams = new URLSearchParams();
    if (useDateRange) { csvParams.set('startDate', startDate); csvParams.set('endDate', endDate); }
    Object.entries(extra).forEach(([k, v]) => { if (v) csvParams.set(k, v); });
    window.open(`/api/v1/reports/${endpoint}/csv?${csvParams}`, '_blank');
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Link to="/reports" className="text-blue-600 hover:underline text-sm print:hidden">← Reports</Link>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </div>
        <button
          onClick={handleCsvExport}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 print:hidden"
        >
          Export CSV
        </button>
      </div>

      {/* Date range filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 print:hidden">
        {useDateRange && (
          <>
            <div className="flex items-center gap-2">
              <label htmlFor="startDate" className="text-sm text-gray-600">From</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="endDate" className="text-sm text-gray-600">To</label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
        {renderFilters?.({ setExtra })}
      </div>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  onClick={() => handleSort(col.key)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => e.key === 'Enter' && handleSort(col.key)}
                >
                  {col.label}{sortIcon(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm ${col.align === 'right' ? 'text-right' : ''}`}>
                    {col.format ? col.format(row[col.key]) : fmt(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && !isLoading && (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">No data found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Previous</button>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
