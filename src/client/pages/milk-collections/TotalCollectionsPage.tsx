import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface VehicleShiftLoadEntry {
  id: string;
  deliverySession: 'morning' | 'evening';
  milkType: 'buffalo' | 'cow';
  quantity: number;
  notes?: string | null;
  recordedAt: string;
  recorder?: { id: string; name: string } | null;
}

interface VillageRow {
  morningQuantity: number;
  eveningQuantity: number;
}

interface MilkCollectionSummary {
  date: string;
  shiftTotals: { morning: number; evening: number; total: number };
  villageRows: VillageRow[];
  vehicleShiftLoads: VehicleShiftLoadEntry[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TotalCollectionsPage() {
  const [searchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || todayStr();
  const [date, setDate] = useState(initialDate);
  const [showVehicleShiftModal, setShowVehicleShiftModal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['milk-collections', 'totals', date],
    queryFn: () => api.get<MilkCollectionSummary>(`/api/v1/milk-collections?date=${date}`),
  });

  const deleteVehicleShiftLoadMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/milk-collections/vehicle-shift-loads/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milk-collections', 'totals', date] }),
  });

  const farmerTotals = useMemo(() => {
    const rows = data?.villageRows ?? [];
    const morning = rows.reduce((sum, row) => sum + Number(row.morningQuantity ?? 0), 0);
    const evening = rows.reduce((sum, row) => sum + Number(row.eveningQuantity ?? 0), 0);
    return { morning, evening, total: morning + evening };
  }, [data?.villageRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Total Collections</h1>
          <p className="text-sm text-gray-500">Shift-level received totals and vehicle loading records in one clean view.</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <button
            type="button"
            onClick={() => setShowVehicleShiftModal(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Update Vehicle Loads
          </button>
          <Link to={`/milk-collections?date=${date}`} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Back to Village Overview
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading totals...</p>}
      {error && <p className="text-sm text-red-600">Failed to load totals.</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Morning Received" value={data?.shiftTotals.morning ?? 0} tone="blue" />
        <SummaryCard label="Evening Received" value={data?.shiftTotals.evening ?? 0} tone="amber" />
        <SummaryCard label="Daily Received" value={data?.shiftTotals.total ?? 0} tone="emerald" />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Farmer Entry vs Final Received</h2>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Metric label="Farmer Morning Total" value={farmerTotals.morning} />
          <Metric label="Farmer Evening Total" value={farmerTotals.evening} />
          <Metric label="Farmer Daily Total" value={farmerTotals.total} />
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Recorder</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(data?.vehicleShiftLoads ?? []).map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">{entry.deliverySession}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">{entry.milkType}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{Number(entry.quantity).toFixed(3)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{entry.recorder?.name ?? 'System'}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this vehicle shift load entry?')) {
                          deleteVehicleShiftLoadMutation.mutate(entry.id);
                        }
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {(data?.vehicleShiftLoads ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No vehicle shift loads recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showVehicleShiftModal && (
        <VehicleShiftLoadModal
          date={date}
          existingEntries={data?.vehicleShiftLoads ?? []}
          onClose={() => setShowVehicleShiftModal(false)}
          onSaved={() => {
            setShowVehicleShiftModal(false);
            queryClient.invalidateQueries({ queryKey: ['milk-collections', 'totals', date] });
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'amber' | 'emerald' }) {
  const palette =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-900'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return (
    <div className={`rounded-lg border p-4 ${palette}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{Number(value ?? 0).toFixed(3)}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{Number(value ?? 0).toFixed(3)}</p>
    </div>
  );
}

function VehicleShiftLoadModal({
  date,
  existingEntries,
  onClose,
  onSaved,
}: {
  date: string;
  existingEntries: VehicleShiftLoadEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const getExisting = (deliverySession: 'morning' | 'evening', milkType: 'buffalo' | 'cow') =>
    existingEntries.find((item) => item.deliverySession === deliverySession && item.milkType === milkType)?.quantity;

  const [morningBuffalo, setMorningBuffalo] = useState(getExisting('morning', 'buffalo')?.toString() ?? '');
  const [morningCow, setMorningCow] = useState(getExisting('morning', 'cow')?.toString() ?? '');
  const [eveningBuffalo, setEveningBuffalo] = useState(getExisting('evening', 'buffalo')?.toString() ?? '');
  const [eveningCow, setEveningCow] = useState(getExisting('evening', 'cow')?.toString() ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submitOne(deliverySession: 'morning' | 'evening', milkType: 'buffalo' | 'cow', value: string) {
    if (!value.trim()) return;
    await api.post('/api/v1/milk-collections/vehicle-shift-loads', {
      loadDate: date,
      deliverySession,
      milkType,
      quantity: Number(value),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await submitOne('morning', 'buffalo', morningBuffalo);
      await submitOne('morning', 'cow', morningCow);
      await submitOne('evening', 'buffalo', eveningBuffalo);
      await submitOne('evening', 'cow', eveningCow);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save vehicle load');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Milk Loaded to Delivery Vehicle</h2>
        <p className="mt-1 text-sm text-gray-500">Record whole-shift vehicle load, not village-wise.</p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ShiftLoadBlock title="Morning" buffalo={morningBuffalo} cow={morningCow} setBuffalo={setMorningBuffalo} setCow={setMorningCow} />
            <ShiftLoadBlock title="Evening" buffalo={eveningBuffalo} cow={eveningCow} setBuffalo={setEveningBuffalo} setCow={setEveningCow} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Vehicle Load'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ShiftLoadBlock({
  title,
  buffalo,
  cow,
  setBuffalo,
  setCow,
}: {
  title: string;
  buffalo: string;
  cow: string;
  setBuffalo: (value: string) => void;
  setCow: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title} Shift</h3>
      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Buffalo</label>
          <input type="number" min="0.001" step="0.001" value={buffalo} onChange={(e) => setBuffalo(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cow</label>
          <input type="number" min="0.001" step="0.001" value={cow} onChange={(e) => setCow(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
    </div>
  );
}
