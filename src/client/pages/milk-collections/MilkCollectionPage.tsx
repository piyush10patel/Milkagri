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
}

interface VehicleShiftLoadEntry {
  id: string;
  deliverySession: 'morning' | 'evening';
  milkType: 'buffalo' | 'cow';
  quantity: number;
  notes?: string | null;
  recordedAt: string;
  recorder?: { id: string; name: string } | null;
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
  vehicleShiftLoads: VehicleShiftLoadEntry[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function buildVillageOsmUrl(villageName: string) {
  const query = `${villageName} village`;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

export default function MilkCollectionPage() {
  const [date, setDate] = useState(todayStr());
  const [showVillageModal, setShowVillageModal] = useState(false);
  const [individualVillageId, setIndividualVillageId] = useState<string | null>(null);
  const [showVehicleShiftModal, setShowVehicleShiftModal] = useState(false);
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
            Village-wise farmer collection vs manually recorded total, with discrepancy for the selected date.
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
          <button
            type="button"
            onClick={() => setShowVehicleShiftModal(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Milk Loaded to Delivery Vehicle
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Morning Received" value={data?.shiftTotals.morning ?? 0} tone="blue" />
        <SummaryCard label="Evening Received" value={data?.shiftTotals.evening ?? 0} tone="amber" />
        <SummaryCard label="Daily Received" value={data?.shiftTotals.total ?? 0} tone="emerald" />
      </div>

      {data && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-900">Vehicle Load by Shift</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Shift</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total Collected</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Buffalo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Cow</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total Loaded</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(['morning', 'evening'] as const).map((session) => {
                  const buffalo = data.vehicleShiftLoads.find((entry) => entry.deliverySession === session && entry.milkType === 'buffalo')?.quantity ?? 0;
                  const cow = data.vehicleShiftLoads.find((entry) => entry.deliverySession === session && entry.milkType === 'cow')?.quantity ?? 0;
                  const totalCollected = data.shiftTotals[session];
                  const totalLoaded = Number((buffalo + cow).toFixed(3));
                  const difference = Number((totalCollected - totalLoaded).toFixed(3));
                  return (
                    <tr key={session}>
                      <td className="px-4 py-3 text-sm font-medium capitalize text-gray-900">{session}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{totalCollected}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{buffalo}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{cow}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{totalLoaded}</td>
                      <td className={`px-4 py-3 text-right text-sm font-medium ${difference !== 0 ? 'text-amber-700' : 'text-gray-500'}`}>{difference}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading collection summary...</p>}
      {error && <p className="text-sm text-red-600">Failed to load milk collection data.</p>}

      {data && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-900">Village Totals</h2>
            <p className="text-sm text-gray-500">Discrepancy = Recorded Total minus Farmers Total.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Village</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Farmers</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Recorded Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Effective Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Discrepancy</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {villageRows.map((row) => {
                  const village = data.villages.find((item) => item.id === row.villageId);
                  const farmerCount = village?.farmers.length ?? 0;

                  return (
                    <tr key={row.villageId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">{row.villageName}</div>
                        <div className="text-xs text-gray-500">{farmerCount} farmers</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{row.farmerTotalQuantity}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{row.individualTotalQuantity}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{row.totalQuantity}</td>
                      <td className={`px-4 py-3 text-right text-sm font-medium ${row.totalDifference !== 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                        {row.totalDifference}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIndividualVillageId(row.villageId)}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Record Total
                          </button>
                          <Link
                            to={`/milk-collections/${row.villageId}?date=${date}`}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            View Details
                          </Link>
                          <a
                            href={buildVillageOsmUrl(row.villageName)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Open OSM
                          </a>
                        </div>
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

      {individualVillageId && data && (
        <VillageIndividualRecordModal
          village={data.villages.find((item) => item.id === individualVillageId)!}
          date={date}
          onClose={() => setIndividualVillageId(null)}
          onSaved={() => {
            setIndividualVillageId(null);
            refresh();
          }}
        />
      )}

      {showVehicleShiftModal && (
        <VehicleShiftLoadModal
          date={date}
          existingEntries={data?.vehicleShiftLoads ?? []}
          onClose={() => setShowVehicleShiftModal(false)}
          onSaved={() => {
            setShowVehicleShiftModal(false);
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

function VillageIndividualRecordModal({
  village,
  date,
  onClose,
  onSaved,
}: {
  village: Village;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [deliverySession, setDeliverySession] = useState<'morning' | 'evening'>('morning');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/milk-collections/individual-records', {
        villageId: village.id,
        collectionDate: date,
        deliverySession,
        quantity: Number(quantity),
        notes,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save individual record');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Record Village Total for {village.name}</h2>
        <p className="mt-1 text-sm text-gray-500">Enter the final recorded total for this shift to compare against farmer collection.</p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Shift</label>
            <select value={deliverySession} onChange={(e) => setDeliverySession(e.target.value as 'morning' | 'evening')} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Recorded Total</label>
            <input type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Optional note for recorded total" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
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
