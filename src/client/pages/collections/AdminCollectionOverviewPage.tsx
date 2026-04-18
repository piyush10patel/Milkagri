import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AgentInfo {
  id: string;
  name: string;
  email: string;
}

interface AgentSummary {
  agent: AgentInfo;
  expected: string | number;
  received: string | number;
  difference: string | number;
  collectionCount: number;
}

interface AgentBalance {
  agent: AgentInfo;
  unremittedBalance: string | number;
  pending: boolean;
}

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currency(value: string | number): string {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function AdminCollectionOverviewPage() {
  const [date, setDate] = useState(todayStr);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [agentFilter, setAgentFilter] = useState('');

  // Use date range if both are set, otherwise use single date
  const isRangeMode = startDate && endDate;

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['collection-summary', date],
    queryFn: () => api.get<{ data: AgentSummary[] }>(`/api/agent-collections/summary?date=${date}`),
    enabled: !isRangeMode,
  });

  const { data: balancesData, isLoading: loadingBalances } = useQuery({
    queryKey: ['agent-balances'],
    queryFn: () => api.get<{ data: AgentBalance[] }>('/api/agent-remittances/balances'),
  });

  // Build a map of agent balances for quick lookup
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of balancesData?.data ?? []) {
      map.set(b.agent.id, Number(b.unremittedBalance));
    }
    return map;
  }, [balancesData]);

  // Collect unique agents for the filter dropdown
  const agents = useMemo(() => {
    const list = summaryData?.data ?? [];
    return list.map((s) => s.agent).sort((a, b) => a.name.localeCompare(b.name));
  }, [summaryData]);

  // Apply agent filter
  const filteredSummaries = useMemo(() => {
    const list = summaryData?.data ?? [];
    if (!agentFilter) return list;
    return list.filter((s) => s.agent.id === agentFilter);
  }, [summaryData, agentFilter]);

  // Grand totals
  const totals = useMemo(() => {
    let expected = 0;
    let received = 0;
    let difference = 0;
    let unremitted = 0;
    for (const s of filteredSummaries) {
      expected += Number(s.expected);
      received += Number(s.received);
      difference += Number(s.difference);
      unremitted += balanceMap.get(s.agent.id) ?? 0;
    }
    return { expected, received, difference, unremitted };
  }, [filteredSummaries, balanceMap]);

  const loading = loadingSummary || loadingBalances;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Collection Overview</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div>
          <label htmlFor="overview-date" className="block text-xs text-gray-500 mb-1">Date</label>
          <input
            id="overview-date"
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setStartDate(''); setEndDate(''); }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="overview-agent" className="block text-xs text-gray-500 mb-1">Agent</label>
          <select
            id="overview-agent"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by agent"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="overview-start" className="block text-xs text-gray-500 mb-1">Range Start</label>
          <input
            id="overview-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="overview-end" className="block text-xs text-gray-500 mb-1">Range End</label>
          <input
            id="overview-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {isRangeMode && (
        <p className="text-sm text-amber-600 mb-3">
          Date range view: showing summary for {date} (range filtering is for future historical API support).
        </p>
      )}

      {loading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent Name</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expected</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Difference</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Un-remitted Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredSummaries.map((s) => {
              const diff = Number(s.difference);
              return (
                <tr key={s.agent.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{s.agent.name}</td>
                  <td className="px-4 py-3 text-sm text-right">{currency(s.expected)}</td>
                  <td className="px-4 py-3 text-sm text-right">{currency(s.received)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                    {currency(s.difference)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {currency(balanceMap.get(s.agent.id) ?? 0)}
                  </td>
                </tr>
              );
            })}
            {filteredSummaries.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  No collection data for this date
                </td>
              </tr>
            )}
          </tbody>
          {filteredSummaries.length > 0 && (
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-sm text-gray-900">Grand Total</td>
                <td className="px-4 py-3 text-sm text-right">{currency(totals.expected)}</td>
                <td className="px-4 py-3 text-sm text-right">{currency(totals.received)}</td>
                <td className={`px-4 py-3 text-sm text-right ${totals.difference > 0 ? 'text-red-600' : totals.difference < 0 ? 'text-green-600' : 'text-gray-700'}`}>
                  {currency(totals.difference)}
                </td>
                <td className="px-4 py-3 text-sm text-right">{currency(totals.unremitted)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
