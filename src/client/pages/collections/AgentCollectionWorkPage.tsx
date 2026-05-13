import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import {
  Milk,
  Navigation,
  MapPin,
  CheckCircle2,
  Sun,
  Moon,
  ChevronRight,
  ListOrdered,
  Save,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';

interface AgentDashboardResponse {
  date: string;
  deliveryRoutes: Array<{ id: string; name: string }>;
  collectionRoutes: Array<{
    id: string;
    name: string;
    stops: Array<{
      villageId: string;
      villageName: string;
      deliverySession: 'morning' | 'evening';
      sequenceOrder: number;
      farmers: Array<{ id: string; name: string }>;
    }>;
  }>;
}

export default function AgentCollectionWorkPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const now = new Date();
  const pad2 = (v: number) => String(v).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  const [date, setDate] = useState(today);
  const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>(
    now.getHours() < 12 ? 'morning' : 'evening'
  );
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [showMap, setShowMap] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-collection-dashboard', date],
    queryFn: () => api.get<AgentDashboardResponse>(`/api/v1/milk-collections/agent-dashboard?date=${date}`),
    enabled: user?.role === 'delivery_agent',
  });

  const routes = data?.collectionRoutes ?? [];
  const activeRoute = selectedRouteId ? routes.find((r) => r.id === selectedRouteId) : routes[0];
  const sessionStops = (activeRoute?.stops ?? []).filter((s) => s.deliverySession === selectedSession);
  const sortedStops = [...sessionStops].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const saveMutation = useMutation({
    mutationFn: (body: { villageId: string; farmerId: string; collectionDate: string; deliverySession: 'morning' | 'evening'; quantity: number }) =>
      api.post('/api/v1/milk-collections', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-collection-dashboard'] });
      toast('success', 'Milk entry saved');
    },
    onError: (err: any) => {
      toast('error', err?.message || 'Failed to save');
    },
  });

  function handleSave(villageId: string, farmerId: string) {
    const key = `${villageId}-${farmerId}`;
    const qty = entries[key];
    if (!qty || Number(qty) <= 0) {
      toast('warning', 'Enter a valid quantity');
      return;
    }
    saveMutation.mutate({
      villageId,
      farmerId,
      collectionDate: date,
      deliverySession: selectedSession,
      quantity: Number(qty),
    });
    setEntries((prev) => ({ ...prev, [key]: '' }));
  }

  const todayStr = today;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="My Collection Work"
        description={`${activeRoute?.name ?? 'No route'} — ${date}`}
        actions={
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
          />
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      )}

      {!isLoading && error && (
        <Card>
          <CardContent className="py-12 text-center">
            <Milk className="h-10 w-10 text-red-300 mx-auto mb-3" />
            <p className="text-red-500 font-medium">Failed to load</p>
            <p className="text-sm text-neutral-400 mt-1">{(error as any)?.message || 'Unable to fetch your collection routes.'}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && routes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Milk className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 font-medium">No collection routes assigned</p>
            <p className="text-sm text-neutral-400 mt-1">Contact your admin to assign you to a collection route.</p>
          </CardContent>
        </Card>
      )}

      {routes.length > 0 && (
        <>
          {/* Route selector + session tabs */}
          <div className="flex flex-wrap items-center gap-3">
            {routes.length > 1 && (
              <select
                value={selectedRouteId || activeRoute?.id || ''}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-1.5 bg-neutral-100 rounded-lg p-1">
              <button
                onClick={() => setSelectedSession('morning')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedSession === 'morning' ? 'bg-white text-primary-700 shadow-soft' : 'text-neutral-600 hover:text-neutral-800'
                }`}
              >
                <Sun className="h-3.5 w-3.5" /> Morning
              </button>
              <button
                onClick={() => setSelectedSession('evening')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedSession === 'evening' ? 'bg-white text-primary-700 shadow-soft' : 'text-neutral-600 hover:text-neutral-800'
                }`}
              >
                <Moon className="h-3.5 w-3.5" /> Evening
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowMap(!showMap)}>
              <Navigation className="h-3.5 w-3.5" />
              {showMap ? 'Hide Map' : 'Show Map'}
            </Button>
          </div>

          {/* Simple stop list */}
          <div className="space-y-3">
            {sortedStops.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-neutral-400">
                  No stops scheduled for {selectedSession} session.
                </CardContent>
              </Card>
            )}
            {sortedStops.map((stop, idx) => (
              <motion.div
                key={`${stop.villageId}-${selectedSession}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-0.5 mt-0.5">
                        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                          {stop.sequenceOrder}
                        </div>
                        {idx < sortedStops.length - 1 && <div className="w-px flex-1 bg-neutral-200 min-h-[8px]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-neutral-900">{stop.villageName}</h3>
                          <Badge variant="neutral" className="text-[10px]">{stop.farmers.length} farmers</Badge>
                        </div>

                        <div className="mt-3 space-y-2">
                          {stop.farmers.map((farmer) => {
                            const key = `${stop.villageId}-${farmer.id}`;
                            const isSaving = saveMutation.isPending && saveMutation.variables?.farmerId === farmer.id;
                            return (
                              <div key={farmer.id} className="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2">
                                <MapPin className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                                <span className="text-sm text-neutral-700 flex-1 min-w-0 truncate">{farmer.name}</span>
                                <input
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  value={entries[key] ?? ''}
                                  onChange={(e) => setEntries((prev) => ({ ...prev, [key]: e.target.value }))}
                                  placeholder="L"
                                  className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-xs text-right focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                                />
                                <button
                                  onClick={() => handleSave(stop.villageId, farmer.id)}
                                  disabled={isSaving || !entries[key]}
                                  className="rounded-md bg-primary-500 p-1.5 text-white hover:bg-primary-600 disabled:opacity-40 transition-colors"
                                  title="Save"
                                >
                                  {isSaving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
