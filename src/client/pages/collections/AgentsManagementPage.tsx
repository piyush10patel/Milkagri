import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type SessionType = 'morning' | 'evening';

interface AgentOption {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface DeliveryRoute {
  id: string;
  name: string;
  routeAgents?: Array<{ userId: string }>;
}

interface CollectionRoute {
  id: string;
  name: string;
  agentIds?: string[];
}

interface VillageData {
  id: string;
  name: string;
  isActive: boolean;
  stops?: Array<{
    id: string;
    name: string;
    isActive: boolean;
    farmers?: Array<{ farmer: { id: string; name: string; isActive: boolean } }>;
  }>;
}

interface CollectionRouteStopsResponse {
  route: { id: string; name: string; isActive: boolean; agentIds?: string[]; agentNames?: string[] };
  deliverySession: SessionType;
  stops: Array<{
    id: string;
    villageStopId?: string | null;
    villageId: string;
    villageName: string;
    stopName?: string;
    sequenceOrder: number;
    farmerIds?: string[];
    defaultFarmerIds?: string[];
  }>;
}

interface CustomerOption {
  id: string;
  name: string;
}

interface AgentAssignment {
  id: string;
  customerId: string;
  agentId: string;
  customer: { id: string; name: string };
  agent: { id: string; name: string };
}

function asListResponse<T>(payload: any): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.data)) return payload.data as T[];
  if (Array.isArray(payload?.items)) return payload.items as T[];
  return [];
}

export default function AgentsManagementPage() {
  const queryClient = useQueryClient();
  const [deliveryRouteId, setDeliveryRouteId] = useState('');
  const [collectionRouteId, setCollectionRouteId] = useState('');
  const [collectionSession, setCollectionSession] = useState<SessionType>('morning');
  const [customerId, setCustomerId] = useState('');
  const [paymentAgentId, setPaymentAgentId] = useState('');
  const [selectedDeliveryAgents, setSelectedDeliveryAgents] = useState<string[]>([]);
  const [selectedCollectionAgents, setSelectedCollectionAgents] = useState<string[]>([]);
  const [selectedVillageStops, setSelectedVillageStops] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: usersData } = useQuery({
    queryKey: ['agents-management-users'],
    queryFn: () => api.get('/api/v1/users?role=delivery_agent&limit=500'),
  });

  const agents = useMemo(
    () =>
      asListResponse<AgentOption>(usersData)
        .filter((user) => user.role === 'delivery_agent' && user.isActive)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [usersData],
  );

  const { data: deliveryRoutesData } = useQuery({
    queryKey: ['agents-management-delivery-routes'],
    queryFn: () => api.get('/api/v1/delivery/routes?routeType=delivery&limit=500'),
  });

  const deliveryRoutes = useMemo(
    () => asListResponse<DeliveryRoute>(deliveryRoutesData).sort((a, b) => a.name.localeCompare(b.name)),
    [deliveryRoutesData],
  );

  const { data: collectionRoutesData } = useQuery({
    queryKey: ['agents-management-collection-routes'],
    queryFn: () => api.get('/api/v1/milk-collections/routes'),
  });

  const collectionRoutes = useMemo(
    () => asListResponse<CollectionRoute>(collectionRoutesData).sort((a, b) => a.name.localeCompare(b.name)),
    [collectionRoutesData],
  );

  const { data: villagesData } = useQuery({
    queryKey: ['agents-management-villages'],
    queryFn: () => api.get('/api/v1/milk-collections/villages'),
  });

  const villages = useMemo(() => asListResponse<VillageData>(villagesData), [villagesData]);

  const villageStopOptions = useMemo(
    () =>
      villages
        .filter((village) => village.isActive)
        .flatMap((village) =>
          (village.stops ?? [])
            .filter((stop) => stop.isActive)
            .map((stop) => ({
              id: stop.id,
              villageId: village.id,
              villageName: village.name,
              stopName: stop.name,
              farmerIds: (stop.farmers ?? [])
                .map((item) => item.farmer)
                .filter((farmer) => farmer?.isActive)
                .map((farmer) => farmer.id),
            })),
        )
        .sort((a, b) => `${a.villageName} ${a.stopName}`.localeCompare(`${b.villageName} ${b.stopName}`)),
    [villages],
  );

  const { data: routeStopsData } = useQuery({
    queryKey: ['agents-management-route-stops', collectionRouteId, collectionSession],
    queryFn: () =>
      api.get<CollectionRouteStopsResponse>(
        `/api/v1/milk-collections/route-stops?routeId=${collectionRouteId}&deliverySession=${collectionSession}`,
      ),
    enabled: !!collectionRouteId,
  });

  const { data: customersData } = useQuery({
    queryKey: ['agents-management-customers'],
    queryFn: () => api.get('/api/v1/customers?status=active&limit=500'),
  });

  const customers = useMemo(
    () => asListResponse<CustomerOption>(customersData).sort((a, b) => a.name.localeCompare(b.name)),
    [customersData],
  );

  const { data: assignmentsData } = useQuery({
    queryKey: ['agents-management-assignments'],
    queryFn: () => api.get('/api/agent-assignments?limit=200'),
  });

  const paymentAssignments = useMemo(
    () => asListResponse<AgentAssignment>(assignmentsData),
    [assignmentsData],
  );

  useEffect(() => {
    if (!routeStopsData) return;
    setSelectedCollectionAgents(routeStopsData.route.agentIds ?? []);
    const existingStopIds = routeStopsData.stops
      .map((stop) => stop.villageStopId)
      .filter((stopId): stopId is string => Boolean(stopId));
    setSelectedVillageStops(existingStopIds);
  }, [routeStopsData]);

  const assignPaymentMutation = useMutation({
    mutationFn: (body: { customerId: string; agentId: string }) => api.post('/api/agent-assignments', body),
    onSuccess: () => {
      setMessage('Payment collection agent assigned');
      setError('');
      setCustomerId('');
      queryClient.invalidateQueries({ queryKey: ['agents-management-assignments'] });
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to assign payment collection agent');
      setMessage('');
    },
  });

  const removePaymentAssignmentMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/agent-assignments/${id}`),
    onSuccess: () => {
      setMessage('Payment collection assignment removed');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['agents-management-assignments'] });
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to remove assignment');
      setMessage('');
    },
  });

  const saveDeliveryAgentsMutation = useMutation({
    mutationFn: (body: { routeId: string; agentIds: string[] }) =>
      api.put(`/api/v1/delivery/routes/${body.routeId}/agents`, { agentIds: body.agentIds }),
    onSuccess: () => {
      setMessage('Delivery route agents updated');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['agents-management-delivery-routes'] });
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save delivery route agents');
      setMessage('');
    },
  });

  const saveCollectionAgentsMutation = useMutation({
    mutationFn: (body: { routeId: string; agentIds: string[] }) =>
      api.put('/api/v1/milk-collections/route-agents', body),
    onSuccess: () => {
      setMessage('Collection route agents updated');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['agents-management-collection-routes'] });
      queryClient.invalidateQueries({ queryKey: ['agents-management-route-stops'] });
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save collection route agents');
      setMessage('');
    },
  });

  const saveVillageAssignmentsMutation = useMutation({
    mutationFn: (body: { routeId: string; deliverySession: SessionType; stops: Array<{ villageStopId: string; sequenceOrder: number; farmerIds: string[] }> }) =>
      api.put('/api/v1/milk-collections/route-stops', body),
    onSuccess: () => {
      setMessage('Village assignments updated');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['agents-management-route-stops'] });
      queryClient.invalidateQueries({ queryKey: ['milk-collections'] });
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save village assignments');
      setMessage('');
    },
  });

  function toggleSelection(value: string, selected: string[], setter: (values: string[]) => void) {
    if (selected.includes(value)) setter(selected.filter((item) => item !== value));
    else setter([...selected, value]);
  }

  function saveVillageAssignments() {
    if (!collectionRouteId) return;
    const stopMap = new Map(villageStopOptions.map((stop) => [stop.id, stop]));
    saveVillageAssignmentsMutation.mutate({
      routeId: collectionRouteId,
      deliverySession: collectionSession,
      stops: selectedVillageStops.map((stopId, index) => ({
        villageStopId: stopId,
        sequenceOrder: index + 1,
        farmerIds: stopMap.get(stopId)?.farmerIds ?? [],
      })),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Agents Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage payment collection, delivery routes, collection routes, and village assignment in one place.
        </p>
      </div>

      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Payment Collection Agent</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
          <select value={paymentAgentId} onChange={(e) => setPaymentAgentId(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select collection agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!customerId || !paymentAgentId) return;
              assignPaymentMutation.mutate({ customerId, agentId: paymentAgentId });
            }}
            disabled={assignPaymentMutation.isPending || !customerId || !paymentAgentId}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {assignPaymentMutation.isPending ? 'Saving...' : 'Assign Payment Agent'}
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Agent</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paymentAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="px-3 py-2 text-sm text-gray-900">{assignment.customer.name}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{assignment.agent.name}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removePaymentAssignmentMutation.mutate(assignment.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {paymentAssignments.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-sm text-gray-500">No payment assignments</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Delivery Route Assignment</h2>
        <div className="mt-3">
          <select
            value={deliveryRouteId}
            onChange={(e) => {
              const nextRouteId = e.target.value;
              setDeliveryRouteId(nextRouteId);
              const route = deliveryRoutes.find((item) => item.id === nextRouteId);
              setSelectedDeliveryAgents((route?.routeAgents ?? []).map((entry) => entry.userId));
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select delivery route</option>
            {deliveryRoutes.map((route) => (
              <option key={route.id} value={route.id}>{route.name}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {agents.map((agent) => (
            <label key={agent.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selectedDeliveryAgents.includes(agent.id)}
                onChange={() => toggleSelection(agent.id, selectedDeliveryAgents, setSelectedDeliveryAgents)}
              />
              <span>{agent.name}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => deliveryRouteId && saveDeliveryAgentsMutation.mutate({ routeId: deliveryRouteId, agentIds: selectedDeliveryAgents })}
          disabled={!deliveryRouteId || saveDeliveryAgentsMutation.isPending}
          className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saveDeliveryAgentsMutation.isPending ? 'Saving...' : 'Save Delivery Agents'}
        </button>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Collection Route + Village Assignment</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select
            value={collectionRouteId}
            onChange={(e) => {
              setCollectionRouteId(e.target.value);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select collection route</option>
            {collectionRoutes.map((route) => (
              <option key={route.id} value={route.id}>{route.name}</option>
            ))}
          </select>
          <select
            value={collectionSession}
            onChange={(e) => setCollectionSession(e.target.value as SessionType)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
          <button
            type="button"
            onClick={() => {
              if (!collectionRouteId) return;
              saveCollectionAgentsMutation.mutate({ routeId: collectionRouteId, agentIds: selectedCollectionAgents });
            }}
            disabled={!collectionRouteId || saveCollectionAgentsMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saveCollectionAgentsMutation.isPending ? 'Saving...' : 'Save Collection Agents'}
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {agents.map((agent) => (
            <label key={agent.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selectedCollectionAgents.includes(agent.id)}
                onChange={() => toggleSelection(agent.id, selectedCollectionAgents, setSelectedCollectionAgents)}
              />
              <span>{agent.name}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-gray-200 p-3">
          <h3 className="text-xs font-semibold uppercase text-gray-600">Assign Villages (Stops)</h3>
          <p className="mt-1 text-xs text-gray-500">
            Villages are assigned via active village stops created from the milk collection setup.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {villageStopOptions.map((stop) => (
              <label key={stop.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedVillageStops.includes(stop.id)}
                  onChange={() => toggleSelection(stop.id, selectedVillageStops, setSelectedVillageStops)}
                />
                <span>{stop.villageName} - {stop.stopName}</span>
              </label>
            ))}
            {villageStopOptions.length === 0 && (
              <p className="text-sm text-gray-500">No active village stops found. Create village stops in Milk Collection first.</p>
            )}
          </div>
          <button
            type="button"
            onClick={saveVillageAssignments}
            disabled={!collectionRouteId || saveVillageAssignmentsMutation.isPending}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saveVillageAssignmentsMutation.isPending ? 'Saving...' : 'Save Village Assignment'}
          </button>
        </div>
      </section>

      {routeStopsData && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Current Collection Route Mapping</h2>
          <p className="mt-1 text-xs text-gray-500">
            {routeStopsData.route.name} ({collectionSession})
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Seq</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Village</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Stop</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {routeStopsData.stops.map((stop) => (
                  <tr key={stop.id}>
                    <td className="px-3 py-2 text-sm text-gray-700">{stop.sequenceOrder}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{stop.villageName}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{stop.stopName ?? 'Main'}</td>
                  </tr>
                ))}
                {routeStopsData.stops.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-sm text-gray-500">No villages assigned for this route/session</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
