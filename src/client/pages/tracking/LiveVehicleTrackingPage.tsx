import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface LiveVehicle {
  user: { id: string; name: string; role: string };
  latestPingAt: string;
  latest: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    speedKmph: number | null;
    headingDegrees: number | null;
    routeId: string | null;
    routeName: string | null;
    deliverySession: 'morning' | 'evening' | null;
  };
  trail: Array<{
    latitude: number;
    longitude: number;
    pingAt: string;
  }>;
}

interface LiveLocationsPayload {
  generatedAt: string;
  minutesWindow: number;
  activeVehicles: number;
  vehicles: LiveVehicle[];
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
      existing.addEventListener('error', () => reject(new Error('Failed to load Leaflet script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Leaflet script'));
    document.body.appendChild(script);
  });

  if (!window.L) throw new Error('Leaflet not available');
  return window.L;
}

function formatAgo(isoDate: string) {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

export default function LiveVehicleTrackingPage() {
  const [minutes, setMinutes] = useState(120);
  const [mapError, setMapError] = useState('');
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicle-live-locations', minutes],
    queryFn: () => api.get<{ data: LiveLocationsPayload }>(`/api/v1/delivery/location/live?minutes=${minutes}`),
    refetchInterval: 30000,
  });

  const payload = data?.data;
  const vehicles = payload?.vehicles ?? [];

  const boundsPoints = useMemo(
    () => vehicles.map((item) => [item.latest.latitude, item.latest.longitude] as [number, number]),
    [vehicles],
  );

  useEffect(() => {
    let cancelled = false;
    async function initMap() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapElRef.current || mapRef.current) return;
        mapRef.current = L.map(mapElRef.current).setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapRef.current);
      } catch (err: any) {
        setMapError(err.message || 'Failed to load map');
      }
    }
    initMap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;

    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }

    const layerGroup = L.layerGroup();
    for (const vehicle of vehicles) {
      const marker = L.marker([vehicle.latest.latitude, vehicle.latest.longitude]);
      marker.bindPopup(
        `<div style="font-size:12px;line-height:1.4;">
          <strong>${vehicle.user.name}</strong><br/>
          Last ping: ${new Date(vehicle.latestPingAt).toLocaleString()}<br/>
          Route: ${vehicle.latest.routeName ?? 'Unassigned'}<br/>
          Shift: ${vehicle.latest.deliverySession ?? '—'}<br/>
          Speed: ${vehicle.latest.speedKmph ?? 0} km/h
        </div>`,
      );
      marker.addTo(layerGroup);

      const trailPoints = vehicle.trail
        .slice()
        .reverse()
        .map((point) => [point.latitude, point.longitude] as [number, number]);
      if (trailPoints.length >= 2) {
        L.polyline(trailPoints, { color: '#2563eb', weight: 3, opacity: 0.7 }).addTo(layerGroup);
      }
    }

    layerGroup.addTo(mapRef.current);
    layerRef.current = layerGroup;

    if (boundsPoints.length > 0) {
      mapRef.current.fitBounds(boundsPoints, { padding: [25, 25] });
    }
  }, [vehicles, boundsPoints]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Live GPS Tracking</h1>
          <p className="text-sm text-gray-500">Internal vehicle movement monitor for super admin.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700" htmlFor="gps-window">Window</label>
          <select
            id="gps-window"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
            <option value={240}>4 hours</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Active Vehicles" value={payload?.activeVehicles ?? 0} />
        <StatCard label="Tracking Window" value={`${payload?.minutesWindow ?? minutes} min`} />
        <StatCard label="Last Refresh" value={payload ? new Date(payload.generatedAt).toLocaleTimeString() : '--'} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div ref={mapElRef} className="h-[420px] w-full rounded-md border border-gray-200" />
      </div>

      {mapError && <p className="text-sm text-red-600">{mapError}</p>}
      {error && <p className="text-sm text-red-600">Failed to load live GPS data.</p>}
      {isLoading && <p className="text-sm text-gray-500">Loading live GPS data...</p>}

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Tracked Vehicles</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Shift</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Speed (km/h)</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Accuracy (m)</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {vehicles.map((vehicle) => (
                <tr key={vehicle.user.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{vehicle.user.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{vehicle.latest.routeName ?? 'Unassigned'}</td>
                  <td className="px-4 py-3 text-sm capitalize text-gray-700">{vehicle.latest.deliverySession ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{vehicle.latest.speedKmph ?? 0}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{vehicle.latest.accuracyMeters ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatAgo(vehicle.latestPingAt)}</td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    No active GPS pings in selected window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
