import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/lib/api';

interface RouteData {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  startLocationMode?: 'none' | 'existing_stop' | 'custom';
  startCustomerId?: string | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  startLabel?: string | null;
}
interface RouteCustomer {
  customerId: string;
  sequenceOrder: number;
  plannedDropQuantity?: number | null;
  dropLatitude?: number | null;
  dropLongitude?: number | null;
  customer: { id: string; name: string; phone: string };
}
interface RouteAgent { userId: string; user: { id: string; name: string; email: string; role: string }; }
interface AgentOption { id: string; name: string; email: string; }
interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  addresses?: Array<{
    isPrimary?: boolean;
    latitude?: number | string | null;
    longitude?: number | string | null;
  }>;
}
interface RouteDetail extends RouteData {
  routeCustomers: RouteCustomer[];
  routeAgents: RouteAgent[];
}

type RouteStop = {
  customerId: string;
  sequenceOrder: number;
  name: string;
  plannedDropQuantity: string;
  dropLatitude: string;
  dropLongitude: string;
};

type PinPoint = { lat: number; lng: number };

declare global {
  interface Window {
    L?: any;
  }
}

async function loadLeaflet() {
  if (window.L) return window.L;

  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (existing) {
      if (window.L) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load map script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load map script'));
    document.body.appendChild(script);
  });

  if (!window.L) throw new Error('Leaflet not available');
  return window.L;
}

export default function RouteFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    description: '',
    startLocationMode: 'none' as 'none' | 'existing_stop' | 'custom',
    startCustomerId: '',
    startLatitude: '',
    startLongitude: '',
    startLabel: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<RouteStop[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [showStartPinModal, setShowStartPinModal] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ['route', id],
    queryFn: () => api.get<RouteDetail>(`/api/v1/routes/${id}`),
    enabled: isEdit,
  });

  const { data: allCustomers } = useQuery({
    queryKey: ['all-customers-for-route'],
    queryFn: () => api.get<{ data: CustomerOption[] }>('/api/v1/customers?limit=500&status=active'),
  });

  const { data: allAgents } = useQuery({
    queryKey: ['all-agents'],
    queryFn: () => api.get<{ data: AgentOption[] }>('/api/v1/users?role=delivery_agent&limit=200'),
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        description: existing.description ?? '',
        startLocationMode: existing.startLocationMode ?? 'none',
        startCustomerId: existing.startCustomerId ?? '',
        startLatitude:
          existing.startLatitude === null || existing.startLatitude === undefined
            ? ''
            : String(existing.startLatitude),
        startLongitude:
          existing.startLongitude === null || existing.startLongitude === undefined
            ? ''
            : String(existing.startLongitude),
        startLabel: existing.startLabel ?? '',
      });
      setCustomers(
        existing.routeCustomers.map((rc) => ({
          customerId: rc.customerId,
          sequenceOrder: rc.sequenceOrder,
          name: rc.customer?.name ?? rc.customerId,
          plannedDropQuantity:
            rc.plannedDropQuantity === null || rc.plannedDropQuantity === undefined
              ? ''
              : String(rc.plannedDropQuantity),
          dropLatitude:
            rc.dropLatitude === null || rc.dropLatitude === undefined
              ? ''
              : String(rc.dropLatitude),
          dropLongitude:
            rc.dropLongitude === null || rc.dropLongitude === undefined
              ? ''
              : String(rc.dropLongitude),
        })),
      );
      setSelectedAgents(existing.routeAgents.map((a) => a.userId));
    }
  }, [existing]);

  const routeMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEdit ? api.put(`/api/v1/routes/${id}`, data) : api.post<{ data: { id: string } }>('/api/v1/routes', data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      if (!isEdit && result && typeof result === 'object' && 'data' in result) {
        navigate(`/routes/${(result as { data: { id: string } }).data.id}/edit`);
      } else if (!isEdit) {
        navigate('/routes');
      }
    },
    onError: (err: ApiError) => {
      if (err.errors) {
        setErrors(
          Object.fromEntries(
            Object.entries(err.errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
          ),
        );
      } else setErrors({ _form: err.message });
    },
  });

  const customersMutation = useMutation({
    mutationFn: (
      data: {
        customers: Array<{
          customerId: string;
          sequenceOrder: number;
          plannedDropQuantity?: number;
          dropLatitude?: number;
          dropLongitude?: number;
        }>;
      },
    ) => api.put(`/api/v1/routes/${id}/customers`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['route', id] }),
  });

  const agentsMutation = useMutation({
    mutationFn: (data: { agentIds: string[] }) => api.put(`/api/v1/routes/${id}/agents`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['route', id] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description || undefined,
      startLocationMode: form.startLocationMode,
      startLabel: form.startLabel || null,
    };
    if (form.startLocationMode === 'existing_stop') {
      payload.startCustomerId = form.startCustomerId || null;
      payload.startLatitude = null;
      payload.startLongitude = null;
    } else if (form.startLocationMode === 'custom') {
      payload.startCustomerId = null;
      payload.startLatitude =
        form.startLatitude.trim() !== '' && !Number.isNaN(Number(form.startLatitude))
          ? Number(form.startLatitude)
          : null;
      payload.startLongitude =
        form.startLongitude.trim() !== '' && !Number.isNaN(Number(form.startLongitude))
          ? Number(form.startLongitude)
          : null;
    } else {
      payload.startCustomerId = null;
      payload.startLatitude = null;
      payload.startLongitude = null;
    }
    routeMutation.mutate(payload);
  }

  function moveCustomer(index: number, direction: -1 | 1) {
    const next = [...customers];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setCustomers(next.map((c, i) => ({ ...c, sequenceOrder: i + 1 })));
  }

  function addCustomer(custId: string) {
    const cust = allCustomers?.data?.find((c) => c.id === custId);
    if (!cust || customers.some((c) => c.customerId === custId)) return;
    const primary = cust.addresses?.find((address) => address.isPrimary) ?? cust.addresses?.[0];
    const latitude =
      primary?.latitude === null || primary?.latitude === undefined ? '' : String(primary.latitude);
    const longitude =
      primary?.longitude === null || primary?.longitude === undefined ? '' : String(primary.longitude);
    setCustomers([
      ...customers,
      {
        customerId: custId,
        sequenceOrder: customers.length + 1,
        name: cust.name,
        plannedDropQuantity: '',
        dropLatitude: latitude,
        dropLongitude: longitude,
      },
    ]);
  }

  function removeCustomer(index: number) {
    setCustomers(customers.filter((_, i) => i !== index).map((c, i) => ({ ...c, sequenceOrder: i + 1 })));
  }

  function updateStopField(
    index: number,
    field: 'plannedDropQuantity' | 'dropLatitude' | 'dropLongitude',
    value: string,
  ) {
    setCustomers((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  }

  function saveCustomers() {
    customersMutation.mutate({
      customers: customers.map((c) => {
        const item: {
          customerId: string;
          sequenceOrder: number;
          plannedDropQuantity?: number;
          dropLatitude?: number;
          dropLongitude?: number;
        } = {
          customerId: c.customerId,
          sequenceOrder: c.sequenceOrder,
        };
        if (c.plannedDropQuantity.trim() !== '' && !Number.isNaN(Number(c.plannedDropQuantity))) {
          item.plannedDropQuantity = Number(c.plannedDropQuantity);
        }
        if (c.dropLatitude.trim() !== '' && !Number.isNaN(Number(c.dropLatitude))) {
          item.dropLatitude = Number(c.dropLatitude);
        }
        if (c.dropLongitude.trim() !== '' && !Number.isNaN(Number(c.dropLongitude))) {
          item.dropLongitude = Number(c.dropLongitude);
        }
        return item;
      }),
    });
  }

  function toggleAgent(agentId: string) {
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((a) => a !== agentId) : [...prev, agentId],
    );
  }

  function saveAgents() {
    agentsMutation.mutate({ agentIds: selectedAgents });
  }

  const fieldClass = (name: string) =>
    `w-full rounded-md border ${errors[name] ? 'border-red-500' : 'border-gray-300'} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">{isEdit ? 'Edit Route' : 'New Route'}</h1>

      {errors._form && (
        <div role="alert" className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errors._form}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 mb-4">
        <div>
          <label htmlFor="rname" className="block text-sm font-medium text-gray-700 mb-1">Route Name *</label>
          <input id="rname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass('name')} required />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="rdesc" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea id="rdesc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={fieldClass('description')} rows={2} />
        </div>
        <fieldset className="rounded-md border border-gray-200 p-3">
          <legend className="px-1 text-xs font-medium text-gray-700">Route Start Location</legend>
          <div className="mt-2 space-y-3">
            <div>
              <label className="mb-1 block text-sm text-gray-700">Start Type</label>
              <select
                value={form.startLocationMode}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    startLocationMode: e.target.value as 'none' | 'existing_stop' | 'custom',
                  }))
                }
                className={fieldClass('startLocationMode')}
              >
                <option value="none">No explicit start</option>
                <option value="existing_stop">Existing stop</option>
                <option value="custom">Custom location</option>
              </select>
            </div>
            {form.startLocationMode === 'existing_stop' && (
              <div>
                <label className="mb-1 block text-sm text-gray-700">Start from Stop</label>
                <select
                  value={form.startCustomerId}
                  onChange={(e) => setForm((prev) => ({ ...prev, startCustomerId: e.target.value }))}
                  className={fieldClass('startCustomerId')}
                >
                  <option value="">Select customer stop</option>
                  {customers.map((stop) => (
                    <option key={stop.customerId} value={stop.customerId}>
                      #{stop.sequenceOrder} {stop.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.startLocationMode === 'custom' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Set custom start by map pin or manual coordinates.</p>
                  <button
                    type="button"
                    onClick={() => setShowStartPinModal(true)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Pin on Map
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-gray-700">Start Latitude</label>
                    <input
                      value={form.startLatitude}
                      onChange={(e) => setForm((prev) => ({ ...prev, startLatitude: e.target.value }))}
                      className={fieldClass('startLatitude')}
                      placeholder="e.g. 12.9715987"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-700">Start Longitude</label>
                    <input
                      value={form.startLongitude}
                      onChange={(e) => setForm((prev) => ({ ...prev, startLongitude: e.target.value }))}
                      className={fieldClass('startLongitude')}
                      placeholder="e.g. 77.594566"
                    />
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm text-gray-700">Start Label (optional)</label>
              <input
                value={form.startLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, startLabel: e.target.value }))}
                className={fieldClass('startLabel')}
                placeholder="Dairy Plant / Depot / Home"
              />
            </div>
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate('/routes')} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={routeMutation.isPending} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {routeMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>

      {isEdit && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Customer Stops (Sequence, Drop Pin, Planned Qty)</h2>
            <button type="button" onClick={saveCustomers} disabled={customersMutation.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
              {customersMutation.isPending ? 'Saving...' : 'Save Stops'}
            </button>
          </div>

          <div className="mb-3">
            <select onChange={(e) => { addCustomer(e.target.value); e.target.value = ''; }} className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full" aria-label="Add customer to route" defaultValue="">
              <option value="" disabled>Add customer...</option>
              {allCustomers?.data?.filter((c) => !customers.some((rc) => rc.customerId === c.id)).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {customers.map((c, i) => (
              <div key={c.customerId} className="border border-gray-100 rounded p-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-6 text-center">{c.sequenceOrder}</span>
                  <span className="text-sm flex-1 font-medium">{c.name}</span>
                  <button type="button" onClick={() => moveCustomer(i, -1)} disabled={i === 0} className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30" aria-label="Move up">↑</button>
                  <button type="button" onClick={() => moveCustomer(i, 1)} disabled={i === customers.length - 1} className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30" aria-label="Move down">↓</button>
                  <button type="button" onClick={() => removeCustomer(i)} className="text-xs text-red-500 hover:text-red-700" aria-label="Remove">✕</button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={c.plannedDropQuantity}
                    onChange={(e) => updateStopField(i, 'plannedDropQuantity', e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                    placeholder="Planned qty"
                  />
                  <input
                    type="number"
                    step="0.00000001"
                    value={c.dropLatitude}
                    onChange={(e) => updateStopField(i, 'dropLatitude', e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                    placeholder="Drop latitude"
                  />
                  <input
                    type="number"
                    step="0.00000001"
                    value={c.dropLongitude}
                    onChange={(e) => updateStopField(i, 'dropLongitude', e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                    placeholder="Drop longitude"
                  />
                </div>
              </div>
            ))}
            {customers.length === 0 && <p className="text-sm text-gray-500">No customers assigned</p>}
          </div>
        </div>
      )}

      {isEdit && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Agent Assignment</h2>
            <button type="button" onClick={saveAgents} disabled={agentsMutation.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
              {agentsMutation.isPending ? 'Saving...' : 'Save Agents'}
            </button>
          </div>
          <div className="space-y-1">
            {allAgents?.data?.map((a) => (
              <label key={a.id} className="flex items-center gap-2 p-2 border border-gray-100 rounded cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selectedAgents.includes(a.id)} onChange={() => toggleAgent(a.id)} className="rounded border-gray-300" />
                <span className="text-sm">{a.name}</span>
                <span className="text-xs text-gray-500">{a.email}</span>
              </label>
            ))}
            {!allAgents?.data?.length && <p className="text-sm text-gray-500">No delivery agents found</p>}
          </div>
        </div>
      )}
      {showStartPinModal && (
        <StartLocationPinModal
          initial={
            form.startLatitude.trim() !== '' && form.startLongitude.trim() !== ''
              ? { lat: Number(form.startLatitude), lng: Number(form.startLongitude) }
              : undefined
          }
          onClose={() => setShowStartPinModal(false)}
          onSelect={(point) => {
            setForm((prev) => ({
              ...prev,
              startLatitude: point.lat.toFixed(8),
              startLongitude: point.lng.toFixed(8),
              startLocationMode: 'custom',
            }));
            setShowStartPinModal(false);
          }}
        />
      )}
    </div>
  );
}

function StartLocationPinModal({
  initial,
  onClose,
  onSelect,
}: {
  initial?: PinPoint;
  onClose: () => void;
  onSelect: (point: PinPoint) => void;
}) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [selected, setSelected] = useState<PinPoint | null>(initial ?? null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapElRef.current || mapRef.current) return;
        const center: [number, number] = selected ? [selected.lat, selected.lng] : [20.5937, 78.9629];
        mapRef.current = L.map(mapElRef.current).setView(center, selected ? 15 : 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapRef.current);

        if (selected) {
          markerRef.current = L.marker([selected.lat, selected.lng]).addTo(mapRef.current);
        }

        mapRef.current.on('click', (evt: any) => {
          const point = { lat: evt.latlng.lat, lng: evt.latlng.lng };
          setSelected(point);
          if (markerRef.current) markerRef.current.remove();
          markerRef.current = L.marker([point.lat, point.lng]).addTo(mapRef.current);
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load map');
      }
    }

    init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Pin Route Start Location</h2>
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            Close
          </button>
        </div>
        <div ref={mapElRef} className="h-[420px] w-full rounded-md border border-gray-200" />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {selected ? `Selected: ${selected.lat.toFixed(8)}, ${selected.lng.toFixed(8)}` : 'Click on map to drop start pin.'}
          </p>
          <button
            type="button"
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Use This Start Point
          </button>
        </div>
      </div>
    </div>
  );
}
