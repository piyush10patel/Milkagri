import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface VillageRow {
  villageId: string;
  villageName: string;
  isActive: boolean;
  farmerMorningQuantity: number;
  farmerEveningQuantity: number;
  farmerTotalQuantity: number;
  individualMorningQuantity: number;
  individualEveningQuantity: number;
  individualTotalQuantity: number;
  morningQuantity: number;
  eveningQuantity: number;
  totalQuantity: number;
  morningDifference: number;
  eveningDifference: number;
  totalDifference: number;
  morningRouteName?: string | null;
  morningAgentNames?: string[];
  eveningRouteName?: string | null;
  eveningAgentNames?: string[];
}

interface MilkCollectionSummary {
  date: string;
  shiftTotals: { morning: number; evening: number; total: number };
  villageRows: VillageRow[];
  vehicleShiftLoads: { id: string; deliverySession: string; milkType: string; quantity: number }[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function Qty({ value }: { value: number }) {
  return <span>{Number(value ?? 0).toFixed(3)}</span>;
}

export default function CollectionRoutesPage() {
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get('date') || todayStr());

  const { data, isLoading, error } = useQuery({
    queryKey: ['milk-collections', 'routes-page', date],
    queryFn: () => api.get<MilkCollectionSummary>(`/api/v1/milk-collections?date=${date}`),
  });

  const villageRows = useMemo(
    () => (data?.villageRows ?? [])
      .filter((row) => row.isActive || row.totalQuantity > 0)
      .sort((a, b) => a.villageName.localeCompare(b.villageName)),
    [data?.villageRows],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Collection Routes & Discrepancies</h1>
          <p className="text-sm text-gray-500">Route assignments, agent details, and discrepancy tracking per village.</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <Link to={`/milk-collections?date=${date}`} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Back to Overview
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading route data...</p>}
      {error && <p className="text-sm text-red-600">Failed to load route data.</p>}

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Village Route Assignments & Discrepancy</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Village</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Route Assignment</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Morning</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Evening</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Discrepancy</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {villageRows.map((row) => (
                <tr key={row.villageId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{row.villageName}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <div>
                      Morning: {row.morningRouteName ? `${row.morningRouteName} (${row.morningAgentNames?.join(', ') || 'No agent'})` : 'Not assigned'}
                    </div>
                    <div>
                      Evening: {row.eveningRouteName ? `${row.eveningRouteName} (${row.eveningAgentNames?.join(', ') || 'No agent'})` : 'Not assigned'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700"><Qty value={row.morningQuantity} /></td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700"><Qty value={row.eveningQuantity} /></td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900"><Qty value={row.totalQuantity} /></td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={row.totalDifference === 0 ? 'text-emerald-700' : 'text-amber-700'}>
                      <Qty value={row.totalDifference} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link to={`/milk-collections/${row.villageId}?date=${date}`} className="text-blue-600 hover:underline">
                      Open Village
                    </Link>
                  </td>
                </tr>
              ))}
              {villageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No villages available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Vehicle Shift Loads</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Shift</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Milk Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(data?.vehicleShiftLoads ?? []).map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">{entry.deliverySession}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">{entry.milkType}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{Number(entry.quantity).toFixed(3)}</td>
                </tr>
              ))}
              {(data?.vehicleShiftLoads ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">No vehicle shift loads recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200 px-4 py-3 text-right">
          <Link to={`/milk-collections/totals?date=${date}`} className="text-sm font-medium text-blue-600 hover:underline">
            Manage Vehicle Loads
          </Link>
        </div>
      </section>
    </div>
  );
}
