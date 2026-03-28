import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type DeliverySession = 'morning' | 'evening';

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

interface FarmerRow {
  farmerId: string;
  farmerName: string;
  villageId: string;
  isActive: boolean;
  morningQuantity: number;
  eveningQuantity: number;
  totalQuantity: number;
}

interface MilkCollectionEntry {
  id: string;
  villageId: string;
  farmerId: string;
  farmerName: string;
  deliverySession: DeliverySession;
  quantity: number;
  notes?: string | null;
  recordedAt: string;
  recorder?: { id: string; name: string } | null;
}

interface IndividualCollectionEntry {
  id: string;
  villageId: string;
  deliverySession: DeliverySession;
  quantity: number;
  notes?: string | null;
  recordedAt: string;
  recorder?: { id: string; name: string } | null;
}

interface MilkCollectionSummary {
  date: string;
  villages: Village[];
  villageRows: VillageRow[];
  farmerRows: FarmerRow[];
  entries: MilkCollectionEntry[];
  individualCollections: IndividualCollectionEntry[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateTime(value?: string | null) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString();
}

function buildVillageOsmUrl(villageName: string) {
  const query = `${villageName} village`;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

export default function VillageCollectionDetailPage() {
  const { villageId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);
  const [collectionFarmer, setCollectionFarmer] = useState<Farmer | null>(null);
  const [showIndividualModal, setShowIndividualModal] = useState(false);

  const date = searchParams.get('date') || todayStr();

  const { data, isLoading, error } = useQuery({
    queryKey: ['milk-collections', date],
    queryFn: () => api.get<MilkCollectionSummary>(`/api/v1/milk-collections?date=${date}`),
  });

  const village = data?.villages.find((item) => item.id === villageId) ?? null;
  const villageRow = data?.villageRows.find((item) => item.villageId === villageId) ?? null;
  const farmerRows = useMemo(
    () => (data?.farmerRows ?? []).filter((item) => item.villageId === villageId).sort((a, b) => a.farmerName.localeCompare(b.farmerName)),
    [data?.farmerRows, villageId],
  );
  const entries = useMemo(() => (data?.entries ?? []).filter((item) => item.villageId === villageId), [data?.entries, villageId]);
  const individualEntries = useMemo(
    () => (data?.individualCollections ?? []).filter((item) => item.villageId === villageId),
    [data?.individualCollections, villageId],
  );

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading village details...</p>;
  }

  if (error || !data || !village || !villageRow) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">Failed to load village details.</p>
        <Link to={`/milk-collections?date=${date}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Back to Milk Collection
        </Link>
      </div>
    );
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['milk-collections', date] });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to={`/milk-collections?date=${date}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Back to Milk Collection
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">{village.name}</h1>
          <p className="text-sm text-gray-500">Farmer collection vs village recorded total with discrepancy tracking for {date}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={buildVillageOsmUrl(village.name)}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Open OSM
          </a>
          <button type="button" onClick={() => setShowFarmerModal(true)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Add Farmer
          </button>
          <button type="button" onClick={() => setShowIndividualModal(true)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Record Total
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Farmer Collection" value={villageRow.farmerTotalQuantity} tone="slate" />
        <SummaryCard label="Recorded Total" value={villageRow.individualTotalQuantity} tone="amber" />
        <SummaryCard label="Effective Total" value={villageRow.totalQuantity} tone="emerald" />
        <SummaryCard label="Discrepancy" value={villageRow.totalDifference} tone="blue" />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Shift Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Shift</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Farmers</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Recorded Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Effective Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Discrepancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <ShiftSummaryRow
                label="Morning"
                farmerQuantity={villageRow.farmerMorningQuantity}
                individualQuantity={villageRow.individualMorningQuantity}
                receivedQuantity={villageRow.morningQuantity}
                differenceQuantity={villageRow.morningDifference}
              />
              <ShiftSummaryRow
                label="Evening"
                farmerQuantity={villageRow.farmerEveningQuantity}
                individualQuantity={villageRow.individualEveningQuantity}
                receivedQuantity={villageRow.eveningQuantity}
                differenceQuantity={villageRow.eveningDifference}
              />
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <EntryCard title="Morning Recorded Total" entry={individualEntries.find((item) => item.deliverySession === 'morning') ?? null} />
        <EntryCard title="Evening Recorded Total" entry={individualEntries.find((item) => item.deliverySession === 'evening') ?? null} />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Farmers and Collection</h2>
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
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{row.farmerName}</div>
                      <div className="text-xs text-gray-500">{row.isActive ? 'Active' : 'Inactive'}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{row.morningQuantity}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{row.eveningQuantity}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{row.totalQuantity}</td>
                    <td className="px-4 py-3 text-right">
                      {farmer && (
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setCollectionFarmer(farmer)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            Record
                          </button>
                          <button type="button" onClick={() => setEditingFarmer(farmer)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                            Manage
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {farmerRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No farmers added for this village yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <CollectionPanel title="Morning Farmer Entries" entries={entries.filter((item) => item.deliverySession === 'morning')} />
        <CollectionPanel title="Evening Farmer Entries" entries={entries.filter((item) => item.deliverySession === 'evening')} />
      </section>

      {showFarmerModal && <FarmerModal village={village} onClose={() => setShowFarmerModal(false)} onSaved={() => { setShowFarmerModal(false); refresh(); }} />}
      {editingFarmer && <FarmerManageModal farmer={editingFarmer} onClose={() => setEditingFarmer(null)} onSaved={() => { setEditingFarmer(null); refresh(); }} />}
      {collectionFarmer && <CollectionEntryModal village={village} farmer={collectionFarmer} date={date} existingEntries={entries.filter((item) => item.farmerId === collectionFarmer.id)} onClose={() => setCollectionFarmer(null)} onSaved={() => { setCollectionFarmer(null); refresh(); }} />}
      {showIndividualModal && <VillageIndividualRecordModal village={village} date={date} existingEntries={individualEntries} onClose={() => setShowIndividualModal(false)} onSaved={() => { setShowIndividualModal(false); refresh(); }} />}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'amber' | 'emerald' | 'blue' }) {
  const toneClasses = {
    slate: 'border-gray-200 bg-gray-50 text-gray-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
  };
  return (
    <div className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ShiftSummaryRow({
  label,
  farmerQuantity,
  individualQuantity,
  receivedQuantity,
  differenceQuantity,
}: {
  label: string;
  farmerQuantity: number;
  individualQuantity: number;
  receivedQuantity: number;
  differenceQuantity: number;
}) {
  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{label}</td>
      <td className="px-4 py-3 text-right text-sm text-gray-900">{farmerQuantity}</td>
      <td className="px-4 py-3 text-right text-sm text-gray-900">{individualQuantity}</td>
      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{receivedQuantity}</td>
      <td className={`px-4 py-3 text-right text-sm font-medium ${differenceQuantity !== 0 ? 'text-amber-700' : 'text-gray-500'}`}>{differenceQuantity}</td>
    </tr>
  );
}

function EntryCard({ title, entry }: { title: string; entry: IndividualCollectionEntry | null }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {entry ? (
        <div className="mt-3 space-y-2 text-sm text-gray-700">
          <div className="flex items-center justify-between"><span>Recorded Total</span><span className="font-medium text-gray-900">{entry.quantity}</span></div>
          <div className="flex items-center justify-between"><span>Recorded</span><span>{fmtDateTime(entry.recordedAt)}</span></div>
          <div className="flex items-center justify-between"><span>Recorder</span><span>{entry.recorder?.name ?? 'Unknown'}</span></div>
          <p className="text-sm text-gray-700">{entry.notes || 'No notes added'}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-500">No recorded total found for this shift.</p>
      )}
    </section>
  );
}


function CollectionPanel({ title, entries }: { title: string; entries: MilkCollectionEntry[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {entries.map((entry) => (
          <div key={entry.id} className="px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">{entry.farmerName}</p>
                <p className="text-xs text-gray-500">{fmtDateTime(entry.recordedAt)}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">{entry.quantity}</p>
                <p className="text-xs text-gray-500">{entry.recorder?.name ?? 'Unknown'}</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-700">{entry.notes || 'No notes added'}</p>
          </div>
        ))}
        {entries.length === 0 && <p className="px-4 py-6 text-sm text-gray-500">No farmer entries recorded for this shift.</p>}
      </div>
    </section>
  );
}

function FarmerModal({
  village,
  onClose,
  onSaved,
}: {
  village: Village;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/milk-collections/farmers', { villageId: village.id, name });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to add farmer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`Add Farmer to ${village.name}`} onClose={onClose}>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label="Farmer Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
        </Field>
        <ModalActions onClose={onClose} submitting={submitting} submitLabel="Save Farmer" />
      </form>
    </ModalShell>
  );
}

function FarmerManageModal({
  farmer,
  onClose,
  onSaved,
}: {
  farmer: Farmer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(farmer.name);
  const [isActive, setIsActive] = useState(farmer.isActive);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.put(`/api/v1/milk-collections/farmers/${farmer.id}`, { name, isActive });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to update farmer');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/api/v1/milk-collections/farmers/${farmer.id}`);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to delete farmer');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ModalShell title={`Manage ${farmer.name}`} onClose={onClose}>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label="Farmer Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-gray-300" />
          Farmer is active
        </label>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={handleDelete} disabled={deleting} className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
            {deleting ? 'Working...' : 'Delete / Deactivate'}
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

function CollectionEntryModal({
  village,
  farmer,
  date,
  existingEntries,
  onClose,
  onSaved,
}: {
  village: Village;
  farmer: Farmer;
  date: string;
  existingEntries: MilkCollectionEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const morningEntry = existingEntries.find((item) => item.deliverySession === 'morning') ?? null;
  const eveningEntry = existingEntries.find((item) => item.deliverySession === 'evening') ?? null;

  const [morningQuantity, setMorningQuantity] = useState(morningEntry ? String(morningEntry.quantity) : '');
  const [morningNotes, setMorningNotes] = useState(morningEntry?.notes ?? '');
  const [eveningQuantity, setEveningQuantity] = useState(eveningEntry ? String(eveningEntry.quantity) : '');
  const [eveningNotes, setEveningNotes] = useState(eveningEntry?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submitEntry(deliverySession: DeliverySession, quantityText: string, notes: string) {
    if (!quantityText.trim()) return;
    await api.post('/api/v1/milk-collections', {
      villageId: village.id,
      farmerId: farmer.id,
      collectionDate: date,
      deliverySession,
      quantity: Number(quantityText),
      notes,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await submitEntry('morning', morningQuantity, morningNotes);
      await submitEntry('evening', eveningQuantity, eveningNotes);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save collection');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`Record Collection for ${farmer.name}`} onClose={onClose}>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <ShiftEntryFields label="Morning" quantity={morningQuantity} notes={morningNotes} setQuantity={setMorningQuantity} setNotes={setMorningNotes} />
        <ShiftEntryFields label="Evening" quantity={eveningQuantity} notes={eveningNotes} setQuantity={setEveningQuantity} setNotes={setEveningNotes} />
        <ModalActions onClose={onClose} submitting={submitting} submitLabel="Save Collection" />
      </form>
    </ModalShell>
  );
}

function VillageIndividualRecordModal({
  village,
  date,
  existingEntries,
  onClose,
  onSaved,
}: {
  village: Village;
  date: string;
  existingEntries: IndividualCollectionEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const morningEntry = existingEntries.find((item) => item.deliverySession === 'morning') ?? null;
  const eveningEntry = existingEntries.find((item) => item.deliverySession === 'evening') ?? null;

  const [morningQuantity, setMorningQuantity] = useState(morningEntry ? String(morningEntry.quantity) : '');
  const [morningNotes, setMorningNotes] = useState(morningEntry?.notes ?? '');
  const [eveningQuantity, setEveningQuantity] = useState(eveningEntry ? String(eveningEntry.quantity) : '');
  const [eveningNotes, setEveningNotes] = useState(eveningEntry?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submitEntry(deliverySession: DeliverySession, quantityText: string, notes: string) {
    if (!quantityText.trim()) return;
    await api.post('/api/v1/milk-collections/individual-records', {
      villageId: village.id,
      collectionDate: date,
      deliverySession,
      quantity: Number(quantityText),
      notes,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await submitEntry('morning', morningQuantity, morningNotes);
      await submitEntry('evening', eveningQuantity, eveningNotes);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save individual record');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={`Record Village Total for ${village.name}`} onClose={onClose}>
      <p className="mt-1 text-sm text-gray-500">Enter final village total for each shift to compare with farmer totals.</p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <ShiftEntryFields label="Morning" quantity={morningQuantity} notes={morningNotes} setQuantity={setMorningQuantity} setNotes={setMorningNotes} />
        <ShiftEntryFields label="Evening" quantity={eveningQuantity} notes={eveningNotes} setQuantity={setEveningQuantity} setNotes={setEveningNotes} />
        <ModalActions onClose={onClose} submitting={submitting} submitLabel="Save Records" />
      </form>
    </ModalShell>
  );
}

function ShiftEntryFields({
  label,
  quantity,
  notes,
  setQuantity,
  setNotes,
}: {
  label: string;
  quantity: string;
  notes: string;
  setQuantity: (value: string) => void;
  setNotes: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label={`${label} Quantity`}>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Leave blank if not recorded"
        />
      </Field>
      <Field label={`${label} Notes`}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Optional note"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  onClose,
  submitting,
  submitLabel,
}: {
  onClose: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
        Cancel
      </button>
      <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}
