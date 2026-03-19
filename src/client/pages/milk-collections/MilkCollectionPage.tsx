import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Shift = 'morning' | 'evening';

interface Village {
  id: string;
  name: string;
  isActive: boolean;
}

interface VillageRow {
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
  villageRows: VillageRow[];
  entries: MilkCollectionEntry[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function MilkCollectionPage() {
  const [date, setDate] = useState(todayStr());
  const [selectedShift, setSelectedShift] = useState<Shift>('morning');
  const [showVillageModal, setShowVillageModal] = useState(false);
  const [entryModalState, setEntryModalState] = useState<{ open: boolean; entry?: MilkCollectionEntry; villageId?: string }>({ open: false });
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['milk-collections', date],
    queryFn: () => api.get<MilkCollectionSummary>(`/api/v1/milk-collections?date=${date}`),
  });

  const visibleRows = useMemo(() => {
    return (data?.villageRows ?? [])
      .filter((row) => row.isActive || row.totalQuantity > 0)
      .map((row) => ({
        ...row,
        shiftQuantity: selectedShift === 'morning' ? row.morningQuantity : row.eveningQuantity,
      }));
  }, [data?.villageRows, selectedShift]);

  const shiftEntries = useMemo(
    () => (data?.entries ?? []).filter((entry) => entry.deliverySession === selectedShift),
    [data?.entries, selectedShift],
  );

  const entriesByVillage = useMemo(() => {
    const map = new Map<string, MilkCollectionEntry>();
    for (const entry of shiftEntries) map.set(entry.villageId, entry);
    return map;
  }, [shiftEntries]);

  const shiftCards: Array<{ key: Shift; label: string; total: number }> = [
    { key: 'morning', label: 'Morning', total: data?.shiftTotals.morning ?? 0 },
    { key: 'evening', label: 'Evening', total: data?.shiftTotals.evening ?? 0 },
  ];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['milk-collections', date] });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Milk Collection</h1>
          <p className="text-sm text-gray-500">
            Record village-wise milk received for morning and evening, then compare it against deliveries in the summary page.
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
            onClick={() => setEntryModalState({ open: true })}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Record Collection
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shiftCards.map((shift) => (
          <button
            key={shift.key}
            type="button"
            onClick={() => setSelectedShift(shift.key)}
            className={`rounded-lg border p-4 text-left ${
              selectedShift === shift.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-900">{shift.label}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                selectedShift === shift.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {selectedShift === shift.key ? 'Selected' : 'Open'}
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-500">Total received</p>
            <p className="text-2xl font-semibold text-gray-900">{shift.total}</p>
          </button>
        ))}

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Daily Total</p>
          <p className="mt-3 text-2xl font-semibold text-emerald-900">{data?.shiftTotals.total ?? 0}</p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading collection summary...</p>}
      {error && <p className="text-sm text-red-600">Failed to load milk collection data.</p>}

      {data && (
        <>
          <section className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 capitalize">{selectedShift} Village Summary</h2>
                <p className="text-sm text-gray-500">Village-wise milk received for {data.date}.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Village</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Received</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Total Day</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visibleRows.map((row) => {
                    const entry = entriesByVillage.get(row.villageId);

                    return (
                      <tr key={row.villageId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{row.villageName}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{row.shiftQuantity}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{row.totalQuantity}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEntryModalState({ open: true, entry, villageId: row.villageId })}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            {entry ? 'Edit' : 'Enter Qty'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                        No villages found. Add your villages first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900 capitalize">{selectedShift} Entries</h2>
              <p className="text-sm text-gray-500">Recorded entries for the selected shift.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Village</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Recorded By</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shiftEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{entry.villageName}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{entry.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.notes || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.recorder.name}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEntryModalState({ open: true, entry, villageId: entry.villageId })}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Delete ${entry.villageName} ${selectedShift} collection entry?`)) return;
                              await api.delete(`/api/v1/milk-collections/${entry.id}`);
                              refresh();
                            }}
                            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {shiftEntries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                        No {selectedShift} entries recorded for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
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

      {entryModalState.open && (
        <CollectionEntryModal
          date={date}
          shift={selectedShift}
          villages={data?.villages ?? []}
          villageId={entryModalState.villageId}
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
        <p className="mt-1 text-sm text-gray-500">Create a village once, then use it for daily collection entry.</p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Village Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Enter village name"
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Village'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CollectionEntryModal({
  date,
  shift,
  villages,
  villageId,
  entry,
  onClose,
  onSaved,
}: {
  date: string;
  shift: Shift;
  villages: Village[];
  villageId?: string;
  entry?: MilkCollectionEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedVillageId, setSelectedVillageId] = useState(entry?.villageId ?? villageId ?? '');
  const [quantity, setQuantity] = useState(entry ? String(entry.quantity) : '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeVillages = villages.filter((village) => village.isActive || village.id === selectedVillageId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/milk-collections', {
        villageId: selectedVillageId,
        collectionDate: date,
        deliverySession: shift,
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
        <h2 className="text-lg font-semibold text-gray-900">{entry ? 'Edit' : 'Record'} {shift} Collection</h2>
        <p className="mt-1 text-sm text-gray-500">Save the quantity received from a village for {date}.</p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Village</label>
            <select
              value={selectedVillageId}
              onChange={(e) => setSelectedVillageId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select village</option>
              {activeVillages.map((village) => (
                <option key={village.id} value={village.id}>{village.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Quantity Received</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
