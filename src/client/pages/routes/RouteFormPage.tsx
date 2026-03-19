import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/lib/api';

interface RouteData { id: string; name: string; description?: string; isActive: boolean; }
interface RouteCustomer { customerId: string; sequenceOrder: number; customer: { id: string; name: string; phone: string }; }
interface RouteAgent { userId: string; user: { id: string; name: string; email: string; role: string }; }
interface AgentOption { id: string; name: string; email: string; }
interface RouteDetail extends RouteData {
  routeCustomers: RouteCustomer[];
  routeAgents: RouteAgent[];
}

export default function RouteFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ name: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<Array<{ customerId: string; sequenceOrder: number; name: string }>>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  const { data: existing } = useQuery({
    queryKey: ['route', id],
    queryFn: () => api.get<RouteDetail>(`/api/v1/routes/${id}`),
    enabled: isEdit,
  });

  const { data: allCustomers } = useQuery({
    queryKey: ['all-customers-for-route'],
    queryFn: () => api.get<{ data: Array<{ id: string; name: string; phone: string }> }>('/api/v1/customers?limit=500&status=active'),
  });

  const { data: allAgents } = useQuery({
    queryKey: ['all-agents'],
    queryFn: () => api.get<{ data: AgentOption[] }>('/api/v1/users?role=delivery_agent&limit=200'),
  });

  useEffect(() => {
    if (existing) {
      setForm({ name: existing.name, description: existing.description ?? '' });
      setCustomers(existing.routeCustomers.map((rc) => ({ customerId: rc.customerId, sequenceOrder: rc.sequenceOrder, name: rc.customer?.name ?? rc.customerId })));
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
      if (err.errors) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      else setErrors({ _form: err.message });
    },
  });

  const customersMutation = useMutation({
    mutationFn: (data: { customers: Array<{ customerId: string; sequenceOrder: number }> }) =>
      api.put(`/api/v1/routes/${id}/customers`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['route', id] }),
  });

  const agentsMutation = useMutation({
    mutationFn: (data: { agentIds: string[] }) => api.put(`/api/v1/routes/${id}/agents`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['route', id] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    routeMutation.mutate({ name: form.name, description: form.description || undefined });
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
    setCustomers([...customers, { customerId: custId, sequenceOrder: customers.length + 1, name: cust.name }]);
  }

  function removeCustomer(index: number) {
    setCustomers(customers.filter((_, i) => i !== index).map((c, i) => ({ ...c, sequenceOrder: i + 1 })));
  }

  function saveCustomers() {
    customersMutation.mutate({ customers: customers.map((c) => ({ customerId: c.customerId, sequenceOrder: c.sequenceOrder })) });
  }

  function toggleAgent(agentId: string) {
    setSelectedAgents((prev) => prev.includes(agentId) ? prev.filter((a) => a !== agentId) : [...prev, agentId]);
  }

  function saveAgents() {
    agentsMutation.mutate({ agentIds: selectedAgents });
  }

  const fieldClass = (name: string) =>
    `w-full rounded-md border ${errors[name] ? 'border-red-500' : 'border-gray-300'} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">{isEdit ? 'Edit Route' : 'New Route'}</h1>

      {errors._form && <div role="alert" className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{errors._form}</div>}

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
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate('/routes')} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={routeMutation.isPending} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {routeMutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>

      {/* Customer assignment (edit mode) */}
      {isEdit && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Customer Assignment (Sequence Order)</h2>
            <button type="button" onClick={saveCustomers} disabled={customersMutation.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
              {customersMutation.isPending ? 'Saving…' : 'Save Order'}
            </button>
          </div>

          <div className="mb-3">
            <select onChange={(e) => { addCustomer(e.target.value); e.target.value = ''; }} className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full" aria-label="Add customer to route" defaultValue="">
              <option value="" disabled>Add customer…</option>
              {allCustomers?.data?.filter((c) => !customers.some((rc) => rc.customerId === c.id)).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            {customers.map((c, i) => (
              <div key={c.customerId} className="flex items-center gap-2 border border-gray-100 rounded p-2">
                <span className="text-xs text-gray-400 w-6 text-center">{c.sequenceOrder}</span>
                <span className="text-sm flex-1">{c.name}</span>
                <button type="button" onClick={() => moveCustomer(i, -1)} disabled={i === 0} className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30" aria-label="Move up">↑</button>
                <button type="button" onClick={() => moveCustomer(i, 1)} disabled={i === customers.length - 1} className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30" aria-label="Move down">↓</button>
                <button type="button" onClick={() => removeCustomer(i)} className="text-xs text-red-500 hover:text-red-700" aria-label="Remove">✕</button>
              </div>
            ))}
            {customers.length === 0 && <p className="text-sm text-gray-500">No customers assigned</p>}
          </div>
        </div>
      )}

      {/* Agent assignment (edit mode) */}
      {isEdit && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Agent Assignment</h2>
            <button type="button" onClick={saveAgents} disabled={agentsMutation.isPending} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
              {agentsMutation.isPending ? 'Saving…' : 'Save Agents'}
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
    </div>
  );
}
