import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type DeliverySession = 'morning' | 'evening';

interface ManifestItem {
  id: string;
  routeId?: string | null;
  routeName?: string | null;
  customer: { id: string; name: string; phone: string; deliveryNotes?: string };
  customerAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  quantity: number;
  plannedDropQuantity?: number | null;
  dropLocation?: { latitude: number; longitude: number } | null;
  deliverySession: DeliverySession;
  status: 'pending' | 'delivered' | 'skipped' | 'failed' | 'returned';
  sequenceOrder: number;
}

declare global {
  interface Window {
    L?: any;
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function buildOsmStopUrl(item: ManifestItem) {
  const dropLat = item.dropLocation?.latitude;
  const dropLon = item.dropLocation?.longitude;
  if (typeof dropLat === 'number' && typeof dropLon === 'number') {
    return `https://www.openstreetmap.org/?mlat=${dropLat}&mlon=${dropLon}#map=17/${dropLat}/${dropLon}`;
  }

  const lat = item.customerAddress?.latitude;
  const lon = item.customerAddress?.longitude;
  if (typeof lat === 'number' && typeof lon === 'number') {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
  }
  const query = [item.customer.name, item.customerAddress?.addressLine1, item.customerAddress?.addressLine2, item.customerAddress?.city]
    .filter(Boolean)
    .join(', ');
  if (!query) return null;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

function buildRouteDirectionsUrl(stops: ManifestItem[]) {
  const points = stops
    .map((item) => {
      const lat = item.customerAddress?.latitude;
      const lon = item.customerAddress?.longitude;
      const dropLat = item.dropLocation?.latitude;
      const dropLon = item.dropLocation?.longitude;
      const finalLat = typeof dropLat === 'number' ? dropLat : lat;
      const finalLon = typeof dropLon === 'number' ? dropLon : lon;
      if (typeof finalLat !== 'number' || typeof finalLon !== 'number') return null;
      return `${finalLat},${finalLon}`;
    })
    .filter((value): value is string => Boolean(value));

  if (points.length < 2) return null;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(points.join(';'))}`;
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

export default function RouteMapPage() {
  const [date, setDate] = useState(todayStr());
  const [selectedSession, setSelectedSession] = useState<DeliverySession>('morning');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('all');
  const [mapError, setMapError] = useState<string>('');
  const mapRef = useRef<any>(null);
  const drawLayerRef = useRef<any>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['route-map-manifest', date],
    queryFn: () => api.get<{ data: ManifestItem[] }>(`/api/v1/delivery/manifest?date=${date}`),
  });

  const manifest = data?.data ?? [];
  const routeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of manifest) {
      if (item.routeId && item.routeName) map.set(item.routeId, item.routeName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [manifest]);

  useEffect(() => {
    if (selectedRouteId !== 'all' && !routeOptions.some((route) => route.id === selectedRouteId)) {
      setSelectedRouteId('all');
    }
  }, [routeOptions, selectedRouteId]);

  const filteredStops = useMemo(() => {
    const items = manifest.filter((item) => item.deliverySession === selectedSession);
    const byRoute = selectedRouteId === 'all' ? items : items.filter((item) => item.routeId === selectedRouteId);
    return [...byRoute].sort((a, b) => a.sequenceOrder - b.sequenceOrder || a.customer.name.localeCompare(b.customer.name));
  }, [manifest, selectedSession, selectedRouteId]);

  const mappedStops = useMemo(
    () =>
      filteredStops.filter(
        (item) =>
          (typeof item.dropLocation?.latitude === 'number' &&
            typeof item.dropLocation?.longitude === 'number') ||
          (typeof item.customerAddress?.latitude === 'number' &&
            typeof item.customerAddress?.longitude === 'number'),
      ),
    [filteredStops],
  );

  const directionsUrl = useMemo(() => buildRouteDirectionsUrl(filteredStops), [filteredStops]);

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

    if (drawLayerRef.current) {
      drawLayerRef.current.remove();
      drawLayerRef.current = null;
    }

    const layerGroup = L.layerGroup();
    const latLngs: Array<[number, number]> = [];

    mappedStops.forEach((item) => {
      const lat = (item.dropLocation?.latitude ?? item.customerAddress!.latitude) as number;
      const lon = (item.dropLocation?.longitude ?? item.customerAddress!.longitude) as number;
      latLngs.push([lat, lon]);

      const marker = L.circleMarker([lat, lon], {
        radius: 8,
        color: '#1d4ed8',
        fillColor: '#2563eb',
        fillOpacity: 0.8,
        weight: 2,
      });

      const address = [item.customerAddress?.addressLine1, item.customerAddress?.addressLine2, item.customerAddress?.city]
        .filter(Boolean)
        .join(', ');

      marker.bindTooltip(`#${item.sequenceOrder}`, { permanent: true, direction: 'top', offset: [0, -10] });
      marker.bindPopup(
        `<div style="font-size:12px;line-height:1.4;">
          <strong>#${item.sequenceOrder} ${item.customer.name}</strong><br/>
          ${address || 'Address not available'}<br/>
          Qty: ${item.quantity}<br/>
          Planned Drop: ${item.plannedDropQuantity ?? '-'}<br/>
          <a href="${buildOsmStopUrl(item) ?? '#'}" target="_blank" rel="noreferrer">Open in OSM</a>
        </div>`,
      );
      marker.addTo(layerGroup);
    });

    if (latLngs.length >= 2) {
      L.polyline(latLngs, { color: '#0f766e', weight: 4, opacity: 0.8 }).addTo(layerGroup);
    }

    layerGroup.addTo(mapRef.current);
    drawLayerRef.current = layerGroup;

    if (latLngs.length > 0) {
      mapRef.current.fitBounds(latLngs, { padding: [20, 20] });
    } else {
      mapRef.current.setView([20.5937, 78.9629], 5);
    }
  }, [mappedStops]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const sessionTabs: Array<{ key: DeliverySession; label: string; count: number }> = [
    { key: 'morning', label: 'Morning', count: manifest.filter((item) => item.deliverySession === 'morning').length },
    { key: 'evening', label: 'Evening', count: manifest.filter((item) => item.deliverySession === 'evening').length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Route Map</h1>
          <p className="text-sm text-gray-500">Custom stoppages on OpenStreetMap with delivery sequence.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All Routes</option>
            {routeOptions.map((route) => (
              <option key={route.id} value={route.id}>
                {route.name}
              </option>
            ))}
          </select>
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open Route Navigation
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {sessionTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedSession(tab.key)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              selectedSession === tab.key
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div ref={mapElRef} className="h-[420px] w-full rounded-md border border-gray-200" />
      </div>

      {mapError && <p className="text-sm text-red-600">{mapError}</p>}
      {error && <p className="text-sm text-red-600">Failed to load delivery data for map.</p>}
      {isLoading && <p className="text-sm text-gray-500">Loading map data...</p>}

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Stops ({filteredStops.length}) | Mapped ({mappedStops.length})
          </h2>
          {filteredStops.length > mappedStops.length && (
            <p className="text-xs text-amber-700">
              {filteredStops.length - mappedStops.length} stop(s) missing latitude/longitude are listed below but not shown on map.
            </p>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filteredStops.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">No stops found for selected filters.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredStops.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">
                      #{item.sequenceOrder} {item.customer.name}
                    </p>
                    <p className="text-xs text-gray-500">{item.routeName ?? 'Unassigned Route'}</p>
                    <p className="text-xs text-gray-500">Planned: {item.plannedDropQuantity ?? '-'}</p>
                    <p className="text-xs text-gray-500">
                      {[item.customerAddress?.addressLine1, item.customerAddress?.addressLine2, item.customerAddress?.city].filter(Boolean).join(', ') || 'Address not available'}
                    </p>
                  </div>
                  {buildOsmStopUrl(item) && (
                    <a
                      href={buildOsmStopUrl(item)!}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Open OSM
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
