import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface FarmerReportRow {
  farmerId: string;
  farmerName: string;
  villageId: string;
  villageName: string;
  totalMorningQuantity: number;
  totalEveningQuantity: number;
  totalQuantity: number;
}

interface FarmerReportResponse {
  items: FarmerReportRow[];
}

interface Village {
  id: string;
  name: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function FarmerMilkReportPage() {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(todayStr());
  const [villageId, setVillageId] = useState('');
  const [ratePerLiter, setRatePerLiter] = useState('');

  const { data: villages } = useQuery({
    queryKey: ['villages'],
    queryFn: () => api.get<{ items: Village[] }>('/api/v1/milk-collections/villages'),
  });

  const params = new URLSearchParams({ startDate, endDate });
  if (villageId) params.set('villageId', villageId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['farmer-milk-report', startDate, endDate, villageId],
    queryFn: () => api.get<FarmerReportResponse>(`/api/v1/milk-collections/farmer-report?${params}`),
  });

  const rate = Number(ratePerLiter) || 0;

  const rows = useMemo(() => {
    return (data?.items ?? []).map((row) => ({
      ...row,
      payment: row.totalQuantity * rate,
    }));
  }, [data?.items, rate]);

  const grandTotals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        morning: acc.morning + row.totalMorningQuantity,
        evening: acc.evening + row.totalEveningQuantity,
        total: acc.total + row.totalQuantity,
        payment: acc.payment + row.payment,
      }),
      { morning: 0, evening: 0, total: 0, payment: 0 },
    );
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/milk-collections" className="text-blue-600 hover:underline text-sm">← Collections</Link>
        <h1 className="text-xl font-semibold text-gray-900">Farmer Milk & Payment Report</h1>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="village" className="block text-sm font-medium text-gray-700 mb-1">Village</label>
          <select id="village" value={villageId} onChange={(e) => setVillageId(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">All Villages</option>
            {(villages?.items ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rate" className="block text-sm font-medium text-gray-700 mb-1">Rate per Liter</label>
          <input id="rate" type="number" min="0" step="0.01" value={ratePerLiter} onChange={(e) => setRatePerLiter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm w-32" placeholder="0.00" />
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading report...</p>}
      {error && <p className="text-sm text-red-600">Failed to load report.</p>}

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Farmer Report</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Farmer</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Village</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total Morning</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total Evening</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total Milk (L)</th>
                {rate > 0 && <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Payment</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row) => (
                <tr key={row.farmerId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.farmerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.villageName}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{row.totalMorningQuantity.toFixed(3)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{row.totalEveningQuantity.toFixed(3)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{row.totalQuantity.toFixed(3)}</td>
                  {rate > 0 && <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{row.payment.toFixed(2)}</td>}
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-4 py-3 text-sm text-gray-900">Grand Total</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{grandTotals.morning.toFixed(3)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{grandTotals.evening.toFixed(3)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{grandTotals.total.toFixed(3)}</td>
                  {rate > 0 && <td className="px-4 py-3 text-right text-sm text-gray-900">{grandTotals.payment.toFixed(2)}</td>}
                </tr>
              )}
              {rows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={rate > 0 ? 6 : 5} className="px-4 py-8 text-center text-sm text-gray-500">No farmer collections found for the selected date range.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
