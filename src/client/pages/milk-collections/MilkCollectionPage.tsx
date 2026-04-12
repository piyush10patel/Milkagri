import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Village {
  id: string;
  name: string;
  isActive: boolean;
  stops?: Array<{
    id: string;
    name: string;
    isActive: boolean;
    latitude?: number | string | null;
    longitude?: number | string | null;
    farmers?: Array<{ farmer: { id: string; name: string; isActive: boolean } }>;
  }>;
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
  morningRouteName?: string | null;
  morningAgentNames?: string[];
  eveningRouteName?: string | null;
  eveningAgentNames?: string[];
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
  villageRouteAssignments?: Array<{
    villageId: string;
    villageName: string;
    morning: { routeName: string; agentNames: string[] } | null;
    evening: { routeName: string; agentNames: string[] } | null;
  }>;
  vehicleShiftLoads: VehicleShiftLoadEntry[];
}

interface CollectionRoute {
  id: string;
  name: string;
  agentIds?: string[];
  agentNames?: string[];
}

interface CollectionRouteStopsResponse {
  route: { id: string; name: string; isActive: boolean; agentIds?: string[]; agentNames?: string[] };
  deliverySession: 'morning' | 'evening';
  stops: Array<{
    id: string;
    villageStopId?: string | null;
    stopName?: string;
    villageId: string;
    villageName: string;
    sequenceOrder: number;
    farmerIds?: string[];
    defaultFarmerIds?: string[];
    farmerNames: string[];
    availableFarmers?: Array<{ id: string; name: string }>;
  }>;
}

interface AgentOption {
  id: string;
  name: string;
  email: string;
}

interface CollectionRouteManifestResponse {
  routeId: string;
  routeName: string;
  agentNames?: string[];
  date: string;
  deliverySession: 'morning' | 'evening';
  totalStops: number;
  stops: Array<{
    sequenceOrder: number;
    villageStopId?: string | null;
    stopName?: string;
    villageId: string;
    villageName: string;
    farmerNames: string[];
    farmerCount: number;
  }>;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function buildVillageOsmUrl(villageName: string) {
  const query = `${villageName} village`;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

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

export default function MilkCollectionPage() {
  const [date, setDate] = useState(todayStr());
  const [showVillageModal, setShowVillageModal] = useState(false);
  const [showVillageStopModal, setShowVillageStopModal] = useState(false);
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [editFarmerTarget, setEditFarmerTarget] = useState<{ id: string; villageId: string; name: string; isActive: boolean } | null>(null);
  const [editStopTarget, setEditStopTarget] = useState<{
    id: string;
    villageId: string;
    villageName: string;
    name: string;
    isActive: boolean;
    latitude?: number | string | null;
    longitude?: number | string | null;
    farmerIds: string[];
  } | null>(null);
  const [individualVillageId, setIndividualVillageId] = useState<string | null>(null);
  const [showVehicleShiftModal, setShowVehicleShiftModal] = useState(false);
  const [collectionSession, setCollectionSession] = useState<'morning' | 'evening'>('morning');
  const [selectedCollectionRouteId, setSelectedCollectionRouteId] = useState('');
  const [newRouteStopId, setNewRouteStopId] = useState('');
  const [routeStopsDraft, setRouteStopsDraft] = useState<
    Array<{
      villageStopId: string;
      stopName: string;
      villageId: string;
      villageName: string;
      sequenceOrder: number;
      farmerIds: string[];
      farmerNames: string[];
      availableFarmers: Array<{ id: string; name: string }>;
    }>
  >([]);
  const [selectedCollectionAgents, setSelectedCollectionAgents] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['milk-collections', date],
    queryFn: () => api.get<MilkCollectionSummary>(`/api/v1/milk-collections?date=${date}`),
  });

  const { data: collectionRoutesData } = useQuery({
    queryKey: ['milk-collection-routes'],
    queryFn: () => api.get<{ items: CollectionRoute[] }>('/api/v1/milk-collections/routes'),
  });

  const { data: allAgents } = useQuery({
    queryKey: ['all-delivery-agents'],
    queryFn: () => api.get<{ data: AgentOption[] }>('/api/v1/users?role=delivery_agent&limit=200'),
  });

  const { data: routeStopsData, isLoading: routeStopsLoading } = useQuery({
    queryKey: ['milk-collection-route-stops', selectedCollectionRouteId, collectionSession],
    queryFn: () =>
      api.get<CollectionRouteStopsResponse>(
        `/api/v1/milk-collections/route-stops?routeId=${selectedCollectionRouteId}&deliverySession=${collectionSession}`,
      ),
    enabled: Boolean(selectedCollectionRouteId),
  });

  const { data: routeManifestData, isLoading: routeManifestLoading } = useQuery({
    queryKey: ['milk-collection-route-manifest', selectedCollectionRouteId, collectionSession, date],
    queryFn: () =>
      api.get<CollectionRouteManifestResponse>(
        `/api/v1/milk-collections/route-manifest?routeId=${selectedCollectionRouteId}&deliverySession=${collectionSession}&date=${date}`,
      ),
    enabled: Boolean(selectedCollectionRouteId),
  });

  const saveRouteStopsMutation = useMutation({
    mutationFn: () =>
      api.put('/api/v1/milk-collections/route-stops', {
        routeId: selectedCollectionRouteId,
        deliverySession: collectionSession,
        stops: routeStopsDraft.map((stop) => ({
          villageStopId: stop.villageStopId,
          sequenceOrder: stop.sequenceOrder,
          farmerIds: stop.farmerIds,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milk-collection-route-stops', selectedCollectionRouteId, collectionSession] });
      queryClient.invalidateQueries({ queryKey: ['milk-collection-route-manifest', selectedCollectionRouteId, collectionSession, date] });
    },
  });

  const saveRouteAgentsMutation = useMutation({
    mutationFn: () =>
      api.put('/api/v1/milk-collections/route-agents', {
        routeId: selectedCollectionRouteId,
        agentIds: selectedCollectionAgents,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milk-collection-route-stops', selectedCollectionRouteId, collectionSession] });
      queryClient.invalidateQueries({ queryKey: ['milk-collection-routes'] });
    },
  });

  const deleteVillageMutation = useMutation({
    mutationFn: (villageId: string) => api.delete(`/api/v1/milk-collections/villages/${villageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milk-collection-summary'] });
      queryClient.invalidateQueries({ queryKey: ['milk-collection-villages'] });
    },
  });

  useEffect(() => {
    if (!selectedCollectionRouteId && collectionRoutesData?.items?.length) {
      setSelectedCollectionRouteId(collectionRoutesData.items[0].id);
    }
  }, [collectionRoutesData, selectedCollectionRouteId]);

  useEffect(() => {
    if (!routeStopsData) {
      setRouteStopsDraft([]);
      return;
    }
    setRouteStopsDraft(
      routeStopsData.stops
        .map((stop) => ({
          villageStopId: stop.villageStopId ?? stop.id,
          stopName: stop.stopName ?? `${stop.villageName} Main`,
          villageId: stop.villageId,
          villageName: stop.villageName,
          sequenceOrder: stop.sequenceOrder,
          farmerIds: stop.farmerIds ?? [],
          farmerNames: stop.farmerNames,
          availableFarmers: stop.availableFarmers ?? [],
        }))
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder),
    );
    setSelectedCollectionAgents(routeStopsData.route.agentIds ?? []);
  }, [routeStopsData]);

  const villageRows = useMemo(
    () => (data?.villageRows ?? []).filter((row) => row.isActive || row.totalQuantity > 0).sort((a, b) => a.villageName.localeCompare(b.villageName)),
    [data?.villageRows],
  );

  const activeVillages = useMemo(
    () => (data?.villages ?? []).filter((village) => village.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [data?.villages],
  );

  const allVillageStops = useMemo(
    () =>
      (data?.villages ?? []).flatMap((village) =>
        (village.stops ?? []).map((stop) => ({
          id: stop.id,
          villageId: village.id,
          villageName: village.name,
          name: stop.name,
          isActive: stop.isActive,
          latitude: stop.latitude,
          longitude: stop.longitude,
          farmerIds: (stop.farmers ?? [])
            .map((item) => item.farmer)
            .filter((farmer) => farmer?.isActive)
            .map((farmer) => farmer.id),
        })),
      ),
    [data?.villages],
  );

  const allFarmers = useMemo(
    () =>
      (data?.villages ?? []).flatMap((village) =>
        village.farmers.map((farmer) => ({
          id: farmer.id,
          villageId: village.id,
          villageName: village.name,
          name: farmer.name,
          isActive: farmer.isActive,
        })),
      ),
    [data?.villages],
  );

  const availableRouteStops = useMemo(
    () =>
      activeVillages
        .flatMap((village) =>
          (village.stops ?? [])
            .filter((stop) => stop.isActive)
            .map((stop) => ({
              villageId: village.id,
              villageName: village.name,
              villageStopId: stop.id,
              stopName: stop.name,
              defaultFarmerIds: (stop.farmers ?? [])
                .map((item) => item.farmer)
                .filter((farmer) => farmer?.isActive)
                .map((farmer) => farmer.id),
              farmers: village.farmers.filter((farmer) => farmer.isActive),
            })),
        )
        .filter((stop) => !routeStopsDraft.some((draft) => draft.villageStopId === stop.villageStopId)),
    [activeVillages, routeStopsDraft],
  );

  function addCollectionStop(villageStopId: string) {
    const stop = availableRouteStops.find((item) => item.villageStopId === villageStopId);
    if (!stop) return;
    setRouteStopsDraft((prev) => [
      ...prev,
      {
        villageStopId: stop.villageStopId,
        stopName: stop.stopName,
        villageId: stop.villageId,
        villageName: stop.villageName,
        sequenceOrder: prev.length + 1,
        farmerIds: stop.defaultFarmerIds,
        farmerNames: stop.defaultFarmerIds.length > 0
          ? stop.farmers.filter((farmer) => stop.defaultFarmerIds.includes(farmer.id)).map((farmer) => farmer.name)
          : stop.farmers.map((farmer) => farmer.name),
        availableFarmers: stop.farmers
          .map((farmer) => ({ id: farmer.id, name: farmer.name })),
      },
    ]);
    setNewRouteStopId('');
  }

  function moveCollectionStop(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= routeStopsDraft.length) return;
    const next = [...routeStopsDraft];
    [next[index], next[target]] = [next[target], next[index]];
    setRouteStopsDraft(next.map((stop, idx) => ({ ...stop, sequenceOrder: idx + 1 })));
  }

  function removeCollectionStop(index: number) {
    setRouteStopsDraft((prev) =>
      prev.filter((_, idx) => idx !== index).map((stop, idx) => ({ ...stop, sequenceOrder: idx + 1 })),
    );
  }

  function toggleCollectionAgent(agentId: string) {
    setSelectedCollectionAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  }

  function toggleStopFarmer(stopIndex: number, farmerId: string) {
    setRouteStopsDraft((prev) =>
      prev.map((stop, idx) => {
        if (idx !== stopIndex) return stop;
        const farmerIds = stop.farmerIds.includes(farmerId)
          ? stop.farmerIds.filter((id) => id !== farmerId)
          : [...stop.farmerIds, farmerId];
        const farmerNames =
          farmerIds.length > 0
            ? stop.availableFarmers.filter((farmer) => farmerIds.includes(farmer.id)).map((farmer) => farmer.name)
            : stop.availableFarmers.map((farmer) => farmer.name);
        return { ...stop, farmerIds, farmerNames };
      }),
    );
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['milk-collections', date] });

  async function handleRemoveVillageStop(stopId: string) {
    if (!window.confirm('Remove this stop? If route history exists it will be deactivated instead.')) return;
    await api.delete(`/api/v1/milk-collections/village-stops/${stopId}`);
    refresh();
  }

  async function handleRemoveFarmer(farmerId: string) {
    if (!window.confirm('Remove this farmer? If collection history exists it will be deactivated instead.')) return;
    await api.delete(`/api/v1/milk-collections/farmers/${farmerId}`);
    refresh();
  }

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
            onClick={() => setShowVillageStopModal(true)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Add Village Stop
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

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Stop Management</h2>
            <p className="text-sm text-gray-500">Manage village pickup stops, map pins, and default farmers.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowVillageStopModal(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + Add Stop
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Village</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Stop</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Pin</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Default Farmers</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allVillageStops.map((stop) => (
                <tr key={stop.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{stop.villageName}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <span className="font-medium">{stop.name}</span>
                    {!stop.isActive && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {stop.latitude != null && stop.longitude != null ? `${stop.latitude}, ${stop.longitude}` : 'Not pinned'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{stop.farmerIds.length || 'All village farmers'}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditStopTarget(stop)}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveVillageStop(stop.id)}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {allVillageStops.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No stops added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Farmers Management</h2>
            <p className="text-sm text-gray-500">Add, edit, and deactivate farmers by village.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowFarmerModal(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + Add Farmer
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Village</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Farmer</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allFarmers.map((farmer) => (
                <tr key={farmer.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{farmer.villageName}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <span className="font-medium">{farmer.name}</span>
                    {!farmer.isActive && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditFarmerTarget(farmer)}
                        className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFarmer(farmer.id)}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {allFarmers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">No farmers added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Milk Collection Route (Location + Farmers)</h2>
          <p className="text-sm text-gray-500">Plan sequence by shift and view farmer names at each collection stop.</p>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedCollectionRouteId}
              onChange={(e) => setSelectedCollectionRouteId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {(collectionRoutesData?.items ?? []).map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}{route.agentNames?.length ? ` (${route.agentNames.join(', ')})` : ''}
                </option>
              ))}
              {!collectionRoutesData?.items?.length && <option value="">No active routes</option>}
            </select>
            <div className="grid grid-cols-2 gap-2">
              {(['morning', 'evening'] as const).map((session) => (
                <button
                  key={session}
                  type="button"
                  onClick={() => setCollectionSession(session)}
                  className={`rounded-md border px-3 py-2 text-xs font-medium capitalize ${
                    collectionSession === session
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {session}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => saveRouteStopsMutation.mutate()}
              disabled={!selectedCollectionRouteId || saveRouteStopsMutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveRouteStopsMutation.isPending ? 'Saving...' : 'Save Collection Route'}
            </button>
            <button
              type="button"
              onClick={() => saveRouteAgentsMutation.mutate()}
              disabled={!selectedCollectionRouteId || saveRouteAgentsMutation.isPending}
              className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {saveRouteAgentsMutation.isPending ? 'Saving...' : 'Save Agents'}
            </button>
            {routeStopsData?.route && (
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                <span className="font-medium">Assigned collection agent(s): </span>
                {routeStopsData.route.agentNames?.length ? routeStopsData.route.agentNames.join(', ') : 'Not assigned'}
              </div>
            )}
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Assign collection agent(s) to this route</p>
            <div className="flex flex-wrap gap-2">
              {(allAgents?.data ?? []).map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => toggleCollectionAgent(agent.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selectedCollectionAgents.includes(agent.id)
                      ? 'border-blue-500 bg-blue-100 text-blue-800'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {agent.name}
                </button>
              ))}
              {!allAgents?.data?.length && (
                <p className="text-xs text-gray-500">No delivery agents found.</p>
              )}
            </div>
          </div>

          {selectedCollectionRouteId && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={newRouteStopId}
                  onChange={(e) => setNewRouteStopId(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Add pickup stop...</option>
                  {availableRouteStops.map((stop) => (
                    <option key={stop.villageStopId} value={stop.villageStopId}>
                      {stop.villageName} - {stop.stopName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => addCollectionStop(newRouteStopId)}
                  disabled={!newRouteStopId}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Add Stop
                </button>
              </div>

              {routeStopsLoading && <p className="text-sm text-gray-500">Loading route stops...</p>}

              <div className="space-y-2">
                {routeStopsDraft.map((stop, index) => (
                  <div key={stop.villageStopId} className="rounded-md border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">#{stop.sequenceOrder} {stop.stopName}</p>
                        <p className="text-xs text-gray-500">Village: {stop.villageName}</p>
                        <p className="text-xs text-gray-500">
                          Farmers to collect from this stop: {stop.farmerNames.length ? stop.farmerNames.join(', ') : 'No active farmers'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {stop.availableFarmers.map((farmer) => (
                            <button
                              key={farmer.id}
                              type="button"
                              onClick={() => toggleStopFarmer(index, farmer.id)}
                              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                stop.farmerIds.length === 0 || stop.farmerIds.includes(farmer.id)
                                  ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                                  : 'border-gray-300 bg-white text-gray-600'
                              }`}
                            >
                              {farmer.name}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500">
                          Tip: if no farmers are selected, all active farmers for this village are used.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => moveCollectionStop(index, -1)} disabled={index === 0} className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-30">↑</button>
                        <button type="button" onClick={() => moveCollectionStop(index, 1)} disabled={index === routeStopsDraft.length - 1} className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-30">↓</button>
                        <button type="button" onClick={() => removeCollectionStop(index)} className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700">Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
                {!routeStopsDraft.length && (
                  <p className="text-sm text-gray-500">No stops set for this route and shift.</p>
                )}
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-900">Collection Manifest for {date} ({collectionSession})</p>
                {routeManifestData?.agentNames?.length ? (
                  <p className="mt-1 text-xs text-gray-600">Assigned collection agent(s): {routeManifestData.agentNames.join(', ')}</p>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">No collection agent assigned to this route yet.</p>
                )}
                {routeManifestLoading && <p className="mt-2 text-sm text-gray-500">Loading manifest...</p>}
                {!routeManifestLoading && routeManifestData && (
                  <div className="mt-2 space-y-2">
                    {routeManifestData.stops.map((stop) => (
                      <div key={`${stop.villageStopId ?? stop.villageId}-${stop.sequenceOrder}`} className="rounded border border-gray-200 bg-white p-2">
                        <p className="text-sm font-medium text-gray-900">#{stop.sequenceOrder} {stop.stopName ?? stop.villageName}</p>
                        <p className="text-xs text-gray-500">Village: {stop.villageName}</p>
                        <p className="text-xs text-gray-600">{stop.farmerNames.length ? stop.farmerNames.join(', ') : 'No active farmers'}</p>
                      </div>
                    ))}
                    {routeManifestData.stops.length === 0 && (
                      <p className="text-sm text-gray-500">No stops mapped for selected route/shift.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>

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
                        <div className="mt-1 text-xs text-gray-600">
                          Morning: {row.morningRouteName ? `${row.morningRouteName} (${row.morningAgentNames?.join(', ') || 'No agent'})` : 'Not assigned'}
                        </div>
                        <div className="text-xs text-gray-600">
                          Evening: {row.eveningRouteName ? `${row.eveningRouteName} (${row.eveningAgentNames?.join(', ') || 'No agent'})` : 'Not assigned'}
                        </div>
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
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete village "${row.villageName}"? If it has collection records it will be deactivated instead.`))
                                deleteVillageMutation.mutate(row.villageId);
                            }}
                            disabled={deleteVillageMutation.isPending}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
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

      {showVillageStopModal && data && (
        <AddVillageStopModal
          villages={data.villages}
          onClose={() => setShowVillageStopModal(false)}
          onSaved={() => {
            setShowVillageStopModal(false);
            refresh();
          }}
        />
      )}

      {showFarmerModal && data && (
        <AddFarmerModal
          villages={data.villages}
          onClose={() => setShowFarmerModal(false)}
          onSaved={() => {
            setShowFarmerModal(false);
            refresh();
          }}
        />
      )}

      {editFarmerTarget && (
        <EditFarmerModal
          farmer={editFarmerTarget}
          onClose={() => setEditFarmerTarget(null)}
          onSaved={() => {
            setEditFarmerTarget(null);
            refresh();
          }}
        />
      )}

      {editStopTarget && data && (
        <EditVillageStopModal
          stop={editStopTarget}
          villages={data.villages}
          onClose={() => setEditStopTarget(null)}
          onSaved={() => {
            setEditStopTarget(null);
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

function AddVillageStopModal({
  villages,
  onClose,
  onSaved,
}: {
  villages: Village[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const activeVillages = villages.filter((village) => village.isActive);
  const [villageId, setVillageId] = useState(activeVillages[0]?.id ?? '');
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [selectedFarmerIds, setSelectedFarmerIds] = useState<string[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const selectedVillage = activeVillages.find((village) => village.id === villageId);
  const availableFarmers = selectedVillage?.farmers.filter((farmer) => farmer.isActive) ?? [];

  useEffect(() => {
    setSelectedFarmerIds([]);
  }, [villageId]);

  function toggleFarmer(farmerId: string) {
    setSelectedFarmerIds((prev) =>
      prev.includes(farmerId) ? prev.filter((id) => id !== farmerId) : [...prev, farmerId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/milk-collections/village-stops', {
        villageId,
        name,
        latitude: latitude.trim() === '' ? undefined : Number(latitude),
        longitude: longitude.trim() === '' ? undefined : Number(longitude),
        farmerIds: selectedFarmerIds,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to add village stop');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Add Village Stop</h2>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Village</label>
            <select value={villageId} onChange={(e) => setVillageId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required>
              {activeVillages.map((village) => (
                <option key={village.id} value={village.id}>{village.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Stop Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. Temple Corner" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Assign Farmers to This Stop (Optional)</label>
            <div className="flex flex-wrap gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
              {availableFarmers.map((farmer) => (
                <button
                  key={farmer.id}
                  type="button"
                  onClick={() => toggleFarmer(farmer.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selectedFarmerIds.includes(farmer.id)
                      ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {farmer.name}
                </button>
              ))}
              {!availableFarmers.length && <p className="text-xs text-gray-500">No active farmers in this village.</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Latitude</label>
              <input type="number" step="0.000001" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Longitude</label>
              <input type="number" step="0.000001" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Optional" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPinModal(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Pin on Map
          </button>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting || !villageId} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Stop'}
            </button>
          </div>
        </form>
        {showPinModal && (
          <StopPinModal
            initialLat={latitude}
            initialLng={longitude}
            onClose={() => setShowPinModal(false)}
            onSelect={(lat, lng) => {
              setLatitude(String(lat));
              setLongitude(String(lng));
              setShowPinModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

function AddFarmerModal({
  villages,
  onClose,
  onSaved,
}: {
  villages: Village[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const activeVillages = villages.filter((village) => village.isActive);
  const [villageId, setVillageId] = useState(activeVillages[0]?.id ?? '');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/milk-collections/farmers', { villageId, name });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to add farmer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Add Farmer</h2>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Village</label>
            <select value={villageId} onChange={(e) => setVillageId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required>
              {activeVillages.map((village) => (
                <option key={village.id} value={village.id}>{village.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Farmer Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting || !villageId} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Farmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditFarmerModal({
  farmer,
  onClose,
  onSaved,
}: {
  farmer: { id: string; villageId: string; name: string; isActive: boolean };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(farmer.name);
  const [isActive, setIsActive] = useState(farmer.isActive);
  const [submitting, setSubmitting] = useState(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Edit Farmer</h2>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Farmer Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Farmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditVillageStopModal({
  stop,
  villages,
  onClose,
  onSaved,
}: {
  stop: {
    id: string;
    villageId: string;
    villageName: string;
    name: string;
    isActive: boolean;
    latitude?: number | string | null;
    longitude?: number | string | null;
    farmerIds: string[];
  };
  villages: Village[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const village = villages.find((item) => item.id === stop.villageId);
  const availableFarmers = village?.farmers.filter((farmer) => farmer.isActive) ?? [];
  const [name, setName] = useState(stop.name);
  const [latitude, setLatitude] = useState(stop.latitude == null ? '' : String(stop.latitude));
  const [longitude, setLongitude] = useState(stop.longitude == null ? '' : String(stop.longitude));
  const [isActive, setIsActive] = useState(stop.isActive);
  const [selectedFarmerIds, setSelectedFarmerIds] = useState<string[]>(stop.farmerIds);
  const [showPinModal, setShowPinModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleFarmer(farmerId: string) {
    setSelectedFarmerIds((prev) =>
      prev.includes(farmerId) ? prev.filter((id) => id !== farmerId) : [...prev, farmerId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.put(`/api/v1/milk-collections/village-stops/${stop.id}`, {
        name,
        isActive,
        latitude: latitude.trim() === '' ? null : Number(latitude),
        longitude: longitude.trim() === '' ? null : Number(longitude),
        farmerIds: selectedFarmerIds,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to update stop');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Edit Stop ({stop.villageName})</h2>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Stop Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Latitude</label>
              <input type="number" step="0.000001" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Longitude</label>
              <input type="number" step="0.000001" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="button" onClick={() => setShowPinModal(true)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Update Pin on Map
          </button>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Default Farmers</label>
            <div className="flex flex-wrap gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
              {availableFarmers.map((farmer) => (
                <button
                  key={farmer.id}
                  type="button"
                  onClick={() => toggleFarmer(farmer.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selectedFarmerIds.includes(farmer.id)
                      ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {farmer.name}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save Stop'}
            </button>
          </div>
        </form>
        {showPinModal && (
          <StopPinModal
            initialLat={latitude}
            initialLng={longitude}
            onClose={() => setShowPinModal(false)}
            onSelect={(lat, lng) => {
              setLatitude(String(lat));
              setLongitude(String(lng));
              setShowPinModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

function StopPinModal({
  initialLat,
  initialLng,
  onClose,
  onSelect,
}: {
  initialLat: string;
  initialLng: string;
  onClose: () => void;
  onSelect: (lat: number, lng: number) => void;
}) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(() => {
    const lat = Number(initialLat);
    const lng = Number(initialLng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapElRef.current || leafletMapRef.current) return;

        const start = selectedPoint ?? { lat: 12.9716, lng: 77.5946 };
        leafletMapRef.current = L.map(mapElRef.current).setView([start.lat, start.lng], selectedPoint ? 14 : 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(leafletMapRef.current);

        if (selectedPoint) {
          markerRef.current = L.marker([selectedPoint.lat, selectedPoint.lng]).addTo(leafletMapRef.current);
        }

        // Fixes occasional blank tiles when modal opens.
        setTimeout(() => leafletMapRef.current?.invalidateSize(), 0);

        leafletMapRef.current.on('click', (event: any) => {
          const lat = Number(event.latlng.lat.toFixed(6));
          const lng = Number(event.latlng.lng.toFixed(6));
          setSelectedPoint({ lat, lng });
          if (markerRef.current) markerRef.current.setLatLng(event.latlng);
          else markerRef.current = L.marker(event.latlng).addTo(leafletMapRef.current);
        });
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load map');
      }
    })();

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-lg bg-white p-4 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Pin Collection Stop on Map</h3>
        <p className="mt-1 text-xs text-gray-500">Click on map to set stop location.</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div ref={mapElRef} className="mt-3 h-80 w-full rounded-md border border-gray-200" />
        <div className="mt-3 text-xs text-gray-600">
          {selectedPoint ? `Selected: ${selectedPoint.lat}, ${selectedPoint.lng}` : 'No point selected yet'}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selectedPoint && onSelect(selectedPoint.lat, selectedPoint.lng)}
            disabled={!selectedPoint}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Use This Pin
          </button>
        </div>
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
