import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface MilkSummaryRow {
  productName: string;
  deliverySession: 'morning' | 'evening';
  routeName: string;
  planned: number;
  delivered: number;
  pending: number;
  skipped: number;
  failed: number;
  returned: number;
  over: number;
  under: number;
  discrepancy: number;
}

interface MilkSummaryCustomerRow {
  id: string;
  customerName: string;
  productName: string;
  routeName: string;
  deliverySession: 'morning' | 'evening';
  quantity: number;
  actualQuantity: number | null;
  status: 'pending' | 'delivered' | 'skipped' | 'failed' | 'returned';
  adjustmentType?: 'exact' | 'over' | 'under' | null;
  adjustmentQuantity: number;
  returnedQuantity: number;
}

interface MilkSummaryResponse {
  date: string;
  totals: {
    planned: number;
    delivered: number;
    pending: number;
    skipped: number;
    failed: number;
    returned: number;
    over: number;
    under: number;
    discrepancy: number;
  };
  collectionTotals: {
    morning: number;
    evening: number;
    total: number;
  };
  bySession: Record<'morning' | 'evening', {
    planned: number;
    delivered: number;
    pending: number;
    skipped: number;
    failed: number;
    returned: number;
    over: number;
    under: number;
    discrepancy: number;
    received: number;
    receivedVsDelivered: number;
  }>;
  rows: MilkSummaryRow[];
  customerRows: MilkSummaryCustomerRow[];
}

export default function OrderMilkSummaryPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedShift, setSelectedShift] = useState<'morning' | 'evening'>('morning');

  const { data, isLoading } = useQuery({
    queryKey: ['orders-milk-summary', date],
    queryFn: () => api.get<MilkSummaryResponse>(`/api/v1/orders/milk-summary?date=${date}`),
  });

  const shiftRows = data?.rows.filter((row) => row.deliverySession === selectedShift) ?? [];
  const shiftCustomerRows = data?.customerRows.filter((row) => row.deliverySession === selectedShift) ?? [];
  const sessionTotals = data?.bySession ?? {
    morning: {
      planned: 0,
      delivered: 0,
      pending: 0,
      skipped: 0,
      failed: 0,
      returned: 0,
      over: 0,
      under: 0,
      discrepancy: 0,
      received: data?.collectionTotals?.morning ?? 0,
      receivedVsDelivered: 0,
    },
    evening: {
      planned: 0,
      delivered: 0,
      pending: 0,
      skipped: 0,
      failed: 0,
      returned: 0,
      over: 0,
      under: 0,
      discrepancy: 0,
      received: data?.collectionTotals?.evening ?? 0,
      receivedVsDelivered: 0,
    },
  };
  const shiftTotals = sessionTotals[selectedShift] ?? {
    planned: 0,
    delivered: 0,
    pending: 0,
    skipped: 0,
    failed: 0,
    returned: 0,
    over: 0,
    under: 0,
    discrepancy: 0,
    received: 0,
    receivedVsDelivered: 0,
  };

  const shiftCards: Array<{ key: 'morning' | 'evening'; label: string }> = [
    { key: 'morning', label: 'Morning' },
    { key: 'evening', label: 'Evening' },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Milk Summary</h1>
            <p className="text-sm text-gray-500">Compare milk received, planned, delivered, and over or under adjustments for each shift.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/milk-collections"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Open Milk Collection
            </Link>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      {data && (
        <>
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">Select Shift</h2>
            <p className="mt-1 text-sm text-gray-500">Choose Morning or Evening for {data.date}. The summary and customer list below update to that shift.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {shiftCards.map((shift) => {
              const totals = sessionTotals[shift.key];
              return (
                <button
                  key={shift.key}
                  type="button"
                  onClick={() => setSelectedShift(shift.key)}
                  className={`rounded-lg border p-4 text-left ${
                    selectedShift === shift.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{shift.label}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      selectedShift === shift.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {selectedShift === shift.key ? 'Selected' : 'Open Summary'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Planned</p>
                  <p className="text-lg font-semibold text-gray-900">{totals.planned}</p>
                  <p className="mt-2 text-xs text-gray-500">Received</p>
                  <p className="text-lg font-semibold text-indigo-700">{totals.received}</p>
                  <p className="mt-2 text-xs text-gray-500">Delivered</p>
                  <p className="text-lg font-semibold text-green-700">{totals.delivered}</p>
                  <p className="mt-2 text-xs text-gray-500">Received vs Delivered</p>
                  <p className={`text-lg font-semibold ${totals.receivedVsDelivered < 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {totals.receivedVsDelivered}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 capitalize">{selectedShift} Summary</h2>
            <p className="text-sm text-gray-500">
              {shiftRows.length > 0
                ? `Showing route and product totals for the ${selectedShift} shift on ${data.date}.`
                : `No ${selectedShift} orders found for ${data.date}.`}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
            <SummaryCard label="Planned" value={shiftTotals.planned} />
            <SummaryCard label="Received" value={shiftTotals.received} />
            <SummaryCard label="Delivered" value={shiftTotals.delivered} />
            <SummaryCard label="Pending" value={shiftTotals.pending} />
            <SummaryCard label="Skipped" value={shiftTotals.skipped} />
            <SummaryCard label="Failed" value={shiftTotals.failed} />
            <SummaryCard label="Returned" value={shiftTotals.returned} />
            <SummaryCard label="Overs" value={shiftTotals.over} />
            <SummaryCard label="Unders" value={shiftTotals.under} />
            <SummaryCard label="Planned Gap" value={shiftTotals.discrepancy} highlight />
            <SummaryCard label="Received Gap" value={shiftTotals.receivedVsDelivered} highlight />
          </div>

          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 mb-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Planned</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Delivered</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Skipped</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Failed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Returned</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Over</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Under</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {shiftRows.map((row, index) => (
                  <tr key={`${row.deliverySession}-${row.routeName}-${row.productName}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm capitalize">{row.deliverySession}</td>
                    <td className="px-4 py-3 text-sm">{row.routeName}</td>
                    <td className="px-4 py-3 text-sm">{row.productName}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.planned}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.delivered}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.pending}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.skipped}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.failed}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.returned}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-700">{row.over}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-700">{row.under}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${row.discrepancy > 0 ? 'text-red-700' : 'text-green-700'}`}>{row.discrepancy}</td>
                  </tr>
                ))}
                {shiftRows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-500">
                      No {selectedShift} orders found for this date
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-base font-semibold text-gray-900 capitalize">{selectedShift} Customer Deliveries</h3>
              <p className="text-sm text-gray-500">Customer-wise orders for the selected shift, including exact, over, and under adjustments.</p>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Planned</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Delivered</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adjustment</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Returned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {shiftCustomerRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{row.customerName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.routeName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.productName}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.quantity}</td>
                    <td className="px-4 py-3 text-sm text-right">{row.actualQuantity ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {row.adjustmentType && row.adjustmentType !== 'exact'
                        ? `${row.adjustmentType} ${row.adjustmentQuantity}`
                        : row.status === 'delivered'
                          ? 'Exact'
                          : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">{row.returnedQuantity > 0 ? row.returnedQuantity : '—'}</td>
                    <td className="px-4 py-3 text-sm capitalize">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        row.status === 'delivered'
                          ? 'bg-green-100 text-green-700'
                          : row.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : row.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : row.status === 'returned'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {shiftCustomerRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                      No customer deliveries found for this shift on this date
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? 'text-amber-900' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
