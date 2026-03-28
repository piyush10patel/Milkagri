import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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

interface RouteNavigationSummary {
  source: 'road' | 'straight-line';
  distanceKm: number;
  durationMin: number;
  steps: string[];
  unroutableSegments?: number;
}

interface RouteDetailStartConfig {
  id: string;
  name: string;
  startLocationMode?: 'none' | 'existing_stop' | 'custom';
  startCustomerId?: string | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  startLabel?: string | null;
}

declare global {
  interface Window {
    L?: any;
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getStopLatLng(item: ManifestItem): [number, number] | null {
  const lat = item.dropLocation?.latitude ?? item.customerAddress?.latitude;
  const lon = item.dropLocation?.longitude ?? item.customerAddress?.longitude;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return [lat, lon];
}

async function fetchRoadSegment(from: [number, number], to: [number, number]) {
  const waypointStr = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${waypointStr}?overview=full&geometries=geojson&steps=true`,
  );
  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new Error('No route geometry');
  }
  return route;
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
  const [navSummary, setNavSummary] = useState<RouteNavigationSummary | null>(null);
  const mapRef = useRef<any>(null);
  const drawLayerRef = useRef<any>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['route-map-manifest', date],
    queryFn: () => api.get<{ data: ManifestItem[] }>(`/api/v1/delivery/manifest?date=${date}`),
  });

  const { data: selectedRouteDetail } = useQuery({
    queryKey: ['route-start-config', selectedRouteId],
    queryFn: () => api.get<RouteDetailStartConfig>(`/api/v1/routes/${selectedRouteId}`),
    enabled: selectedRouteId !== 'all',
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

  const startPoint = useMemo(() => {
    if (!selectedRouteDetail || selectedRouteDetail.startLocationMode === 'none' || !mappedStops.length) return null;
    if (selectedRouteDetail.startLocationMode === 'custom') {
      if (
        typeof selectedRouteDetail.startLatitude === 'number' &&
        typeof selectedRouteDetail.startLongitude === 'number'
      ) {
        return {
          lat: selectedRouteDetail.startLatitude,
          lon: selectedRouteDetail.startLongitude,
          label: selectedRouteDetail.startLabel || 'Custom Start',
        };
      }
      return null;
    }

    const matched = mappedStops.find((stop) => stop.customer.id === selectedRouteDetail.startCustomerId);
    const coords = matched ? getStopLatLng(matched) : null;
    if (!coords) return null;
    const matchedLabel = matched ? matched.customer.name : 'Existing Stop';
    return {
      lat: coords[0],
      lon: coords[1],
      label: selectedRouteDetail.startLabel || `Start: ${matchedLabel}`,
    };
  }, [mappedStops, selectedRouteDetail]);

  const directionsUrl = useMemo(() => buildRouteDirectionsUrl(filteredStops), [filteredStops]);
  const totalPlannedQty = useMemo(
    () => filteredStops.reduce((sum, item) => sum + Number(item.plannedDropQuantity ?? item.quantity ?? 0), 0),
    [filteredStops],
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
    let cancelled = false;

    async function draw() {
      if (drawLayerRef.current) {
        drawLayerRef.current.remove();
        drawLayerRef.current = null;
      }

      const layerGroup = L.layerGroup();
      const latLngs: Array<[number, number]> = [];
      if (startPoint) {
        latLngs.push([startPoint.lat, startPoint.lon]);
        const startMarker = L.marker([startPoint.lat, startPoint.lon], { title: startPoint.label });
        startMarker.bindPopup(
          `<div style="font-size:12px;line-height:1.4;"><strong>${startPoint.label}</strong><br/>Route start location</div>`,
        );
        startMarker.addTo(layerGroup);
      }

      mappedStops.forEach((item) => {
        const coords = getStopLatLng(item);
        if (!coords) return;
        const [lat, lon] = coords;
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
            Phone: ${item.customer.phone}<br/>
            Status: ${item.status}<br/>
            ${address || 'Address not available'}<br/>
            Planned Drop: ${item.plannedDropQuantity ?? item.quantity}<br/>
            Notes: ${item.customer.deliveryNotes ?? '-'}
          </div>`,
        );
        marker.addTo(layerGroup);
      });

      if (latLngs.length >= 2) {
        const mergedPath: Array<[number, number]> = [];
        let totalDistance = 0;
        let totalDuration = 0;
        let usedRoadSegments = 0;
        let unroutableSegments = 0;
        const turnSteps: string[] = [];

        for (let idx = 0; idx < latLngs.length - 1; idx++) {
          const from = latLngs[idx];
          const to = latLngs[idx + 1];
          try {
            const route = await fetchRoadSegment(from, to);
            const roadCoords: Array<[number, number]> = route.geometry.coordinates.map(
              (coord: [number, number]) => [coord[1], coord[0]] as [number, number],
            );
            if (mergedPath.length > 0 && roadCoords.length > 0) {
              roadCoords.shift();
            }
            mergedPath.push(...roadCoords);
            totalDistance += Number(route.distance ?? 0);
            totalDuration += Number(route.duration ?? 0);
            usedRoadSegments += 1;

            const localSteps = (route.legs ?? [])
              .flatMap((leg: any) => leg.steps ?? [])
              .slice(0, 2)
              .map((step: any) => {
                const maneuverType = step?.maneuver?.type ?? 'Continue';
                const road = step?.name ? ` on ${step.name}` : '';
                return `${maneuverType}${road}`;
              });
            turnSteps.push(...localSteps);
          } catch {
            if (mergedPath.length > 0) {
              const last = mergedPath[mergedPath.length - 1];
              if (last[0] === from[0] && last[1] === from[1]) mergedPath.push(to);
              else mergedPath.push(from, to);
            } else {
              mergedPath.push(from, to);
            }
            unroutableSegments += 1;
          }
        }

        const hasRoad = usedRoadSegments > 0;
        L.polyline(mergedPath, {
          color: '#0f766e',
          weight: 5,
          opacity: 0.85,
          dashArray: hasRoad ? undefined : '6,6',
        }).addTo(layerGroup);

        setNavSummary({
          source: hasRoad ? 'road' : 'straight-line',
          distanceKm: Number((totalDistance / 1000).toFixed(2)),
          durationMin: Math.round(totalDuration / 60),
          steps: turnSteps.slice(0, 10).length
            ? turnSteps.slice(0, 10)
            : ['Road routing unavailable for selected segments. Straight-line fallback shown.'],
          unroutableSegments,
        });
      } else {
        setNavSummary(null);
      }

      if (!cancelled) {
        layerGroup.addTo(mapRef.current);
        drawLayerRef.current = layerGroup;
        if (latLngs.length > 0) {
          mapRef.current.fitBounds(latLngs, { padding: [20, 20] });
        } else {
          mapRef.current.setView([20.5937, 78.9629], 5);
        }
      }
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [mappedStops, startPoint]);

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
          <p className="text-sm text-gray-500">Custom stoppages on OpenStreetMap with sequence, customer and drop details.</p>
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
          {selectedRouteId !== 'all' && (
            <Link
              to={`/routes/${selectedRouteId}/edit`}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Manage Stop Priority
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Stops" value={filteredStops.length} />
        <StatCard label="Mapped Stops" value={mappedStops.length} />
        <StatCard label="Planned Qty" value={Number(totalPlannedQty.toFixed(3))} />
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

      {navSummary && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">
            In-app Driver Route {navSummary.source === 'road' ? '(Road-based)' : '(Fallback)'}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Distance: {navSummary.distanceKm} km | Est. time: {navSummary.durationMin} min
          </p>
          {navSummary.unroutableSegments && navSummary.unroutableSegments > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              {navSummary.unroutableSegments} segment(s) had no road path and were shown with fallback lines.
            </p>
          )}
          {navSummary.steps.length > 0 && (
            <div className="mt-2 grid gap-1">
              {navSummary.steps.map((step, idx) => (
                <p key={`${step}-${idx}`} className="text-xs text-gray-700">
                  {idx + 1}. {step}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

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
                <li
                  key={item.id}
                  className={`flex items-start justify-between gap-3 px-4 py-3 text-sm ${
                    getStopLatLng(item) ? '' : 'bg-red-50'
                  }`}
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      #{item.sequenceOrder} {item.customer.name}
                    </p>
                    <p className="text-xs text-gray-500">{item.customer.phone} | {item.routeName ?? 'Unassigned Route'}</p>
                    <p className="text-xs text-gray-500">Status: {item.status} | Planned: {item.plannedDropQuantity ?? item.quantity}</p>
                    <p className="text-xs text-gray-500">
                      Coords: {getStopLatLng(item)?.[0]?.toFixed(6) ?? 'NA'}, {getStopLatLng(item)?.[1]?.toFixed(6) ?? 'NA'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {[item.customerAddress?.addressLine1, item.customerAddress?.addressLine2, item.customerAddress?.city].filter(Boolean).join(', ') || 'Address not available'}
                    </p>
                    {!getStopLatLng(item) && (
                      <p className="text-xs font-medium text-red-700">
                        Missing stop coordinates. Set drop pin or customer pin.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.routeId && (
                      <Link
                        to={`/routes/${item.routeId}/edit`}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit Stop
                      </Link>
                    )}
                    <span className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600">
                      In-App
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
