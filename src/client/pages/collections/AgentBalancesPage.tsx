import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AgentInfo {
  id: string;
  name: string;
  email: string;
}

interface AgentBalance {
  agent: AgentInfo;
  unremittedBalance: string | number;
  pending: boolean;
}

function currency(value: string | number): string {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function AgentBalancesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-balances'],
    queryFn: () => api.get<{ data: AgentBalance[] }>('/api/agent-remittances/balances'),
  });

  const balances = data?.data ?? [];

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Agent Balances</h1>

      {isLoading && <p className="text-sm text-gray-500" aria-live="polite">Loading…</p>}

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent Name</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Un-remitted Balance</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pending</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {balances.map((b) => (
              <tr key={b.agent.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{b.agent.name}</td>
                <td className="px-4 py-3 text-sm text-right">{currency(b.unremittedBalance)}</td>
                <td className="px-4 py-3 text-sm text-center">
                  {b.pending ? (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Pending
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      Clear
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {balances.length === 0 && !isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                  No agent balance data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
