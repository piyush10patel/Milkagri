import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Shift = 'morning' | 'evening';

interface Farmer {
  id: string;
  name: string;
  isActive: boolean;
}

interface Village {
  id: string;
  name: string;
  isActive: boolean;
  farmers: Farmer[];
}

interface FarmerRow {
  farmerId: string;
  farmerName: string;
  villageId: string;
  villageName: string;
  isActive: boolean;
  morningQuantity: number;
  eveningQuantity: number;
  totalQuantity: number;
}

interface MilkCollectionEntry {
  id: string;
  villageId: string;
  villageName: string;
  farmerId: string;
  farmerName: string;
  deliverySession: Shift;
  quantity: number;
  notes: string | null;
  recordedAt: string;
  recorder: { id: string; name: string };
}

interface MilkCollectionSummary {
  date: string;
  shiftTotals: {
    morning: number;
    evening: number;
    total: number;
  };
  villages: Village[];
  farmerRows: FarmerRow[];
  entries: MilkCollectionEntry[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function VillageCollectionDetailPage() {
  const { villageId = '' } = useParams();
  const location = useLocation();
  const initialDate = new URLSearchParams(location.search).get('date') || todayStr();
  const [date, setDate] = useState(initialDate);
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [farmerModalState, setFarmerModalState] = useState<{ open: boolean; farmer?: Farmer }>({ open: false });
  const [entryModalState, setEntryModalState] = useState<{ open: boolean; entry?: MilkCollectionEntry; farmerId?: string }>({ open: false });
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['milk-collections', date],
    queryFn: () => api.get<MilkCollectionSummary>(`/api/v1/milk-collections?date=${date}`),
  });

  const village = data?.villages.find((item) => item.id === villageId);
  const farmerRows = useMemo(
    () => (data?.farmerRows ?? []).filter((row) => row.villageId === villageId).sort((a, b) => a.farmerName.localeCompare(b.farmerName)),
    [data?.farmerRows, villageId],
  );
  const entries = useMemo(
    () => (data?.entries ?? []).filter((entry) => entry.villageId === villageId),
    [data?.entries, villageId],
  );

  const villageTotals = useMemo(() => ({
    morning: farmerRows.reduce((sum, row) => sum + row.morningQuantity, 0),
    evening: farmerRows.reduce((sum, row) => sum + row.eveningQuantity, 0),
    total: farmerRows.reduce((sum, row) => sum + row.totalQuantity, 0),
  }), [farmerRows]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['milk-collections', date] });

  if (!isLoading && data && !village) {
    return (
      <div className="space-y-4">
        <Link to="/milk-collections" className="text-sm text-blue-600 hover:text-blue-700">← Back to Milk Collection</Link>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-gray-900">Village not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to="/milk-collections" className="text-sm text-blue-600 hover:text-blue-700">← Back to Milk Collection</Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">{village?.name ?? 'Village Details'}</h1>
          <p className="text-sm text-gray-500">Morning and evening collection together for one village.</p>
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
            onClick={() => setFarmerModalState({ open: true })}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Add Farmer
          </button>
          <button
            type="button"
            onClick={() => setEntryModalState({ open: true })}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Record Collection
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Morning Total" value={villageTotals.morning} tone="blue" />
        <SummaryCard label="Evening Total" value={villageTotals.evening} tone="amber" />
        <SummaryCard label="Daily Total" value={villageTotals.total} tone="emerald" />
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading village summary...</p>}
      {error && <p className="text-sm text-red-600">Failed to load village collection data.</p>}

      {village && (
        <>
          <section className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">Farmer Totals</h2>
              <p className="text-sm text-gray-500">Morning and evening quantities side by side for {data?.date}.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Farmer</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Morning</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Evening</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {farmerRows.map((row) => {
                    const farmer = village.farmers.find((item) => item.id === row.farmerId);
                    return (
                    <tr key={row.farmerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{row.farmerName}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{row.morningQuantity}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{row.eveningQuantity}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{row.totalQuantity}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEntryModalState({ open: true, farmerId: row.farmerId })}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Record
                          </button>
                          <button
                            type="button"
                            onClick={() => setFarmerModalState({ open: true, farmer })}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Remove ${row.farmerName}? If history exists, the farmer will be deactivated instead.`)) return;
                              await api.delete(`/api/v1/milk-collections/farmers/${row.farmerId}`);
                              refresh();
                            }}
                            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                  {farmerRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No farmers found for this village.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <ShiftEntriesCard
              title="Morning Entries"
              shift="morning"
              entries={entries.filter((entry) => entry.deliverySession === 'morning')}
              onEdit={(entry) => setEntryModalState({ open: true, entry, farmerId: entry.farmerId })}
              onDelete={async (entry) => {
                if (!window.confirm(`Delete ${entry.farmerName} morning collection entry?`)) return;
                await api.delete(`/api/v1/milk-collections/${entry.id}`);
                refresh();
              }}
            />
            <ShiftEntriesCard
              title="Evening Entries"
              shift="evening"
              entries={entries.filter((entry) => entry.deliverySession === 'evening')}
              onEdit={(entry) => setEntryModalState({ open: true, entry, farmerId: entry.farmerId })}
              onDelete={async (entry) => {
                if (!window.confirm(`Delete ${entry.farmerName} evening collection entry?`)) return;
                await api.delete(`/api/v1/milk-collections/${entry.id}`);
                refresh();
              }}
            />
          </section>
        </>
      )}

      {farmerModalState.open && village && (
        <FarmerModal
          village={village}
          farmer={farmerModalState.farmer}
          onClose={() => setFarmerModalState({ open: false })}
          onSaved={() => {
            setFarmerModalState({ open: false });
            refresh();
          }}
        />
      )}

      {entryModalState.open && village && (
        <CollectionEntryModal
          date={date}
          village={village}
          farmerId={entryModalState.farmerId}
          entry={entryModalState.entry}
          onClose={() => setEntryModalState({ open: false })}
          onSaved={() => {
            setEntryModalState({ open: false });
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

function ShiftEntriesCard({
  title,
  shift,
  entries,
  onEdit,
  onDelete,
}: {
  title: string;
  shift: Shift;
  entries: MilkCollectionEntry[];
  onEdit: (entry: MilkCollectionEntry) => void;
  onDelete: (entry: MilkCollectionEntry) => void | Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Farmer</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Notes</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Recorded By</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{entry.farmerName}</td>
                <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{entry.quantity}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{entry.notes || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{entry.recorder.name}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => onEdit(entry)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      Edit
                    </button>
                    <button type="button" onClick={() => onDelete(entry)} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No {shift} entries recorded for this date.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FarmerModal({
  village,
  farmer,
  onClose,
  onSaved,
}: {
  village: Village;
  farmer?: Farmer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(farmer?.name ?? '');
  const [isActive, setIsActive] = useState(farmer?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (farmer) {
        await api.put(`/api/v1/milk-collections/farmers/${farmer.id}`, { name, isActive });
      } else {
        await api.post('/api/v1/milk-collections/farmers', { villageId: village.id, name });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || `Failed to ${farmer ? 'update' : 'add'} farmer`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">{farmer ? 'Manage Farmer' : 'Add Farmer'} {farmer ? '' : `to ${village.name}`}</h2>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Farmer Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
          </div>
          {farmer && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : farmer ? 'Save Changes' : 'Save Farmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CollectionEntryModal({
  date,
  village,
  farmerId,
  entry,
  onClose,
  onSaved,
}: {
  date: string;
  village: Village;
  farmerId?: string;
  entry?: MilkCollectionEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedFarmerId, setSelectedFarmerId] = useState(entry?.farmerId ?? farmerId ?? '');
  const [deliverySession, setDeliverySession] = useState<Shift>(entry?.deliverySession ?? 'morning');
  const [quantity, setQuantity] = useState(entry ? String(entry.quantity) : '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const farmers = village.farmers.filter((farmer) => farmer.isActive || farmer.id === selectedFarmerId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/milk-collections', {
        villageId: village.id,
        farmerId: selectedFarmerId,
        collectionDate: date,
        deliverySession,
        quantity: parseFloat(quantity),
        notes,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save collection entry');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">{entry ? 'Edit' : 'Record'} Collection for {village.name}</h2>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Farmer</label>
            <select value={selectedFarmerId} onChange={(e) => setSelectedFarmerId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required>
              <option value="">Select farmer</option>
              {farmers.map((farmer) => (
                <option key={farmer.id} value={farmer.id}>{farmer.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Shift</label>
            <select value={deliverySession} onChange={(e) => setDeliverySession(e.target.value as Shift)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Quantity Received</label>
            <input type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Optional notes" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
