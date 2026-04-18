import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { decodePolyline, type RouteWaypoint } from '@/lib/waypointOperations';
import { formatDistance, formatDuration } from '@/lib/routeFormatters';

// Extend Window for Leaflet global
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
      if (window.L) { resolve(); return; }
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

interface RoutePathResponse {
  polyline: string | null;
  waypoints: RouteWaypoint[] | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  generatedAt: string | null;
  isStale: boolean;
}

interface DriverRouteMapProps {
  routeId: string;
}

export default function DriverRouteMap({ routeId }: DriverRouteMapProps) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['driver-route-path', routeId],
    queryFn: () => api.get<RoutePathResponse | { path: null }>(`/api/v1/delivery/routes/${routeId}/path`),
    enabled: Boolean(routeId),
  });

  // Normalize: the API returns { path: null } when no path exists
  const pathData = data && 'path' in data && data.path === null ? null : (data as RoutePathResponse | undefined);

  const customerStops = pathData?.waypoints?.filter((wp) => wp.type === 'customer_stop') ?? [];
  const hasPath = Boolean(pathData?.polyline);

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;

    async function initMap() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapElRef.current) return;

        // Create map once
        if (!mapRef.current) {
          mapRef.current = L.map(mapElRef.current).setView([20.5937, 78.9629], 5);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(mapRef.current);
        }

        // Clear existing markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        // Clear existing polyline
        if (polylineRef.current) {
          polylineRef.current.remove();
          polylineRef.current = null;
        }

        // Render polyline if path data exists
        if (pathData?.polyline) {
          try {
            const coords = decodePolyline(pathData.polyline);
            if (coords.length > 0) {
              polylineRef.current = L.polyline(coords, {
                color: '#6366f1',
                weight: 4,
                opacity: 0.8,
              }).addTo(mapRef.current);
            }
          } catch {
            setMapError('Unable to display route path');
          }
        }

        // Add numbered markers for customer stops
        customerStops.forEach((wp, i) => {
          const icon = L.divIcon({
            className: '',
            html: `<div style="
              background:#2563eb;color:#fff;width:28px;height:28px;
              border-radius:50%;display:flex;align-items:center;justify-content:center;
              font-size:13px;font-weight:600;border:2px solid #fff;
              box-shadow:0 1px 4px rgba(0,0,0,.3);
            ">${i + 1}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          const marker = L.marker([wp.latitude, wp.longitude], { icon }).addTo(mapRef.current);
          markersRef.current.push(marker);
        });

        // Fit bounds
        if (polylineRef.current) {
          mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40], maxZoom: 16 });
        } else if (customerStops.length > 0) {
          const bounds = L.latLngBounds(customerStops.map((wp) => [wp.latitude, wp.longitude]));
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        }
      } catch {
        setMapError('Failed to load map');
      }
    }

    initMap();
    return () => { cancelled = true; };
  }, [isLoading, pathData, customerStops.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (isLoading) {
    return <div className="text-sm text-gray-500 py-4">Loading route map…</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600 py-4">Failed to load route path data.</div>;
  }

  return (
    <div>
      {/* Distance / Duration summary */}
      {hasPath && pathData?.distanceMeters != null && pathData?.durationSeconds != null && (
        <div className="flex gap-4 mb-2 text-sm text-gray-700">
          <span>Distance: <strong>{formatDistance(pathData.distanceMeters)}</strong></span>
          <span>Duration: <strong>{formatDuration(pathData.durationSeconds)}</strong></span>
        </div>
      )}

      {!hasPath && (
        <p className="text-sm text-gray-500 mb-2">No route path generated</p>
      )}

      {mapError && (
        <p className="text-sm text-red-600 mb-2">{mapError}</p>
      )}

      <div ref={mapElRef} style={{ height: 400, width: '100%', borderRadius: 8 }} />
    </div>
  );
}
