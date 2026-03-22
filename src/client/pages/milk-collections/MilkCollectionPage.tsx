import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Village {
  id: string;
  name: string;
  isActive: boolean;
  farmers: Array<{ id: string; name: string; isActive: boolean }>;
}

interface VillageRow {
  villageId: string;
  villageName: string;
  isActive: boolean;
  morningQuantity: number;
  eveningQuantity: number;
  totalQuantity: number;
}

interface MilkCollectionSummary {
  date: string;
  shiftTotals: {
    morning: number;
    evening: number;
    total: number;
  };
  villages: Village[];
  villageRows: VillageRow[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function MilkCollectionPage() {
  const [date, setDate] = useState(todayStr());
  const [showVillageModal, setShowVillageModal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['milk-collections', date],
    queryFn: () => api.get<MilkCollectionSummary>(`/api/v1/milk-collections?date=${date}`),
  });

  const villageRows = useMemo(
    () => (data?.villageRows ?? []).filter((row) => row.isActive || row.totalQuantity > 0).sort((a, b) => a.villageName.localeCompare(b.villageName)),
    [data?.villageRows],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['milk-collections', date] });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Milk Collection</h1>
          <p className="text-sm text-gray-500">
            Village-wise totals for the selected date. Open a village to see morning and evening details together.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowVillageModal(true)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Add Village
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Morning Total" value={data?.shiftTotals.morning ?? 0} tone="blue" />
        <SummaryCard label="Evening Total" value={data?.shiftTotals.evening ?? 0} tone="amber" />
        <SummaryCard label="Daily Total" value={data?.shiftTotals.total ?? 0} tone="emerald" />
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading collection summary...</p>}
      {error && <p className="text-sm text-red-600">Failed to load milk collection data.</p>}

      {data && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-900">Village Totals</h2>
            <p className="text-sm text-gray-500">Each village opens in a separate detail page with both shifts visible together.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Village</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Morning</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Evening</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Farmers</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {villageRows.map((row) => {
                  const village = data.villages.find((item) => item.id === row.villageId);
                  const farmerCount = village?.farmers.length ?? 0;

                  return (
                    <tr key={row.villageId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{row.villageName}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{row.morningQuantity}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{row.eveningQuantity}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{row.totalQuantity}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{farmerCount}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/milk-collections/${row.villageId}?date=${date}`}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {villageRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No villages found. Add your villages first.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showVillageModal && (
        <AddVillageModal
          onClose={() => setShowVillageModal(false)}
          onSaved={() => {
            setShowVillageModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'amber' | 'emerald' }) {
  const toneClasses = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function AddVillageModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/milk-collections/villages', { name });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to add village');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Add Village</h2>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Village Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Village'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
