import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/lib/api';

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  deliveryNotes?: string;
  preferredDeliveryWindow?: string;
  routeId?: string;
  pricingCategory?: string;
  billingFrequency?: string;
  addresses?: Array<{
    id: string;
    isPrimary: boolean;
    addressLine1: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
  }>;
}

interface RouteOption { id: string; name: string; }
interface PricingCategoryOption { id: string; code: string; name: string; isActive: boolean; }
interface PricingMatrixRow {
  id: string; sku?: string | null; unitType: string; quantityPerUnit: number;
  product: { id: string; name: string };
  latestPrices: { default: { price: number } | null; categories: Record<string, { price: number } | null> };
}
type PinPoint = { lat: number; lng: number };

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

export default function CustomerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ name: '', phone: '', email: '', deliveryNotes: '', preferredDeliveryWindow: '', routeId: '', pricingCategory: '', billingFrequency: 'monthly' });
  const [address, setAddress] = useState({ addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', latitude: '', longitude: '' });
  const [primaryAddressId, setPrimaryAddressId] = useState<string>('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [showPricePreview, setShowPricePreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existing } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<{ data: CustomerData }>(`/api/v1/customers/${id}`),
    enabled: isEdit,
  });

  const { data: routesData } = useQuery({
    queryKey: ['routes-options'],
    queryFn: () => api.get<{ data: RouteOption[] }>('/api/v1/routes?limit=200'),
  });

  const { data: pricingCategoriesData } = useQuery({
    queryKey: ['pricing-categories-options'],
    queryFn: () => api.get<{ data: PricingCategoryOption[] }>('/api/v1/pricing-categories'),
  });

  const { data: pricingMatrixData } = useQuery({
    queryKey: ['pricing-matrix-customer'],
    queryFn: () => api.get<{ data: { categories: PricingCategoryOption[]; rows: PricingMatrixRow[] } }>('/api/v1/products/pricing-matrix'),
  });

  useEffect(() => {
    if (existing?.data) {
      const c = existing.data;
      setForm({ name: c.name, phone: c.phone, email: c.email ?? '', deliveryNotes: c.deliveryNotes ?? '', preferredDeliveryWindow: c.preferredDeliveryWindow ?? '', routeId: c.routeId ?? '', pricingCategory: c.pricingCategory ?? '', billingFrequency: c.billingFrequency ?? 'monthly' });
      const primary = c.addresses?.find((a) => a.isPrimary) ?? c.addresses?.[0];
      if (primary) {
        setPrimaryAddressId(primary.id);
        setAddress({
          addressLine1: primary.addressLine1 ?? '',
          addressLine2: primary.addressLine2 ?? '',
          city: primary.city ?? '',
          state: primary.state ?? '',
          pincode: primary.pincode ?? '',
          latitude: primary.latitude === null || primary.latitude === undefined ? '' : String(primary.latitude),
          longitude: primary.longitude === null || primary.longitude === undefined ? '' : String(primary.longitude),
        });
      }
    }
  }, [existing]);

  useEffect(() => {
    if (!isEdit && !form.pricingCategory && pricingCategoriesData?.data?.length) {
      setForm((current) => ({ ...current, pricingCategory: pricingCategoriesData.data[0].code }));
    }
  }, [form.pricingCategory, isEdit, pricingCategoriesData]);

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const basePayload: Record<string, unknown> = { ...data };

      const latitude =
        address.latitude.trim() !== '' && !Number.isNaN(Number(address.latitude))
          ? Number(address.latitude)
          : undefined;
      const longitude =
        address.longitude.trim() !== '' && !Number.isNaN(Number(address.longitude))
          ? Number(address.longitude)
          : undefined;

      const hasAddressFields =
        Boolean(address.addressLine1.trim()) ||
        Boolean(address.addressLine2.trim()) ||
        Boolean(address.city.trim()) ||
        Boolean(address.state.trim()) ||
        Boolean(address.pincode.trim()) ||
        latitude !== undefined ||
        longitude !== undefined;

      const fallbackLine1 =
        address.addressLine1.trim() ||
        (latitude !== undefined && longitude !== undefined ? 'Pinned location' : 'Address not specified');

      const addressPayload = hasAddressFields
        ? {
            addressLine1: primaryAddressId ? (address.addressLine1.trim() || undefined) : fallbackLine1,
            addressLine2: address.addressLine2.trim() || undefined,
            city: address.city.trim() || undefined,
            state: address.state.trim() || undefined,
            pincode: address.pincode.trim() || undefined,
            latitude,
            longitude,
            isPrimary: true,
          }
        : null;

      if (isEdit) {
        await api.put(`/api/v1/customers/${id}`, basePayload);
        if (addressPayload) {
          if (primaryAddressId) {
            await api.put(`/api/v1/customers/${id}/addresses/${primaryAddressId}`, addressPayload);
          } else {
            await api.post(`/api/v1/customers/${id}/addresses`, addressPayload);
          }
        }
        return;
      }

      if (addressPayload) {
        basePayload.address = addressPayload;
      }
      await api.post('/api/v1/customers', basePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (isEdit && id) queryClient.invalidateQueries({ queryKey: ['customer', id] });
      navigate('/customers');
    },
    onError: (err: ApiError) => {
      if (err.errors) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      else setErrors({ _form: err.message });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const payload: Record<string, unknown> = { name: form.name, phone: form.phone };
    if (form.email) payload.email = form.email;
    if (form.deliveryNotes) payload.deliveryNotes = form.deliveryNotes;
    if (form.preferredDeliveryWindow) payload.preferredDeliveryWindow = form.preferredDeliveryWindow;
    if (form.routeId) payload.routeId = form.routeId;
    if (form.pricingCategory) payload.pricingCategory = form.pricingCategory;
    payload.billingFrequency = form.billingFrequency;
    mutation.mutate(payload);
  }

  const fieldClass = (name: string) =>
    `w-full rounded-md border ${errors[name] ? 'border-red-500' : 'border-gray-300'} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">{isEdit ? 'Edit Customer' : 'New Customer'}</h1>

      {errors._form && <div role="alert" className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{errors._form}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass('name')} required />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
          <input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldClass('phone')} required />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass('email')} />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="routeId" className="block text-sm font-medium text-gray-700 mb-1">Route</label>
          <select id="routeId" value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} className={fieldClass('routeId')}>
            <option value="">No route</option>
            {routesData?.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="pricingCategory" className="block text-sm font-medium text-gray-700 mb-1">Pricing Category</label>
          <select id="pricingCategory" value={form.pricingCategory} onChange={(e) => { setForm({ ...form, pricingCategory: e.target.value }); setShowPricePreview(false); }} className={fieldClass('pricingCategory')}>
            <option value="">Select pricing category</option>
            {pricingCategoriesData?.data?.map((category) => (
              <option key={category.id} value={category.code}>{category.name}</option>
            ))}
          </select>
          {errors.pricingCategory && <p className="text-xs text-red-600 mt-1">{errors.pricingCategory}</p>}
          {form.pricingCategory && (pricingMatrixData?.data?.rows?.length ?? 0) > 0 && (() => {
            const catName = pricingCategoriesData?.data?.find((c) => c.code === form.pricingCategory)?.name ?? form.pricingCategory;
            const rows = pricingMatrixData?.data?.rows ?? [];
            const withCatPrice = rows.filter((r) => r.latestPrices.categories[form.pricingCategory]);
            return (
              <div className="mt-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">
                    {catName}: {withCatPrice.length} product{withCatPrice.length !== 1 ? 's' : ''} with custom pricing, {rows.length - withCatPrice.length} at default
                  </p>
                  <button type="button" onClick={() => setShowPricePreview(!showPricePreview)} className="text-xs text-blue-600 hover:underline">
                    {showPricePreview ? 'Hide' : 'View prices'}
                  </button>
                </div>
                {showPricePreview && (
                  <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-blue-600">
                          <th className="text-left py-0.5 font-medium">Product</th>
                          <th className="text-right py-0.5 font-medium">Default</th>
                          <th className="text-right py-0.5 font-medium">{catName}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const catPrice = r.latestPrices.categories[form.pricingCategory];
                          const defPrice = r.latestPrices.default;
                          if (!catPrice && !defPrice) return null;
                          return (
                            <tr key={r.id} className="border-t border-blue-100/50">
                              <td className="py-0.5 text-blue-800">{r.product.name} — {r.quantityPerUnit} {r.unitType}</td>
                              <td className="py-0.5 text-right text-blue-600">{defPrice ? `₹${Number(defPrice.price).toFixed(0)}` : '—'}</td>
                              <td className="py-0.5 text-right font-medium">{catPrice ? <span className="text-blue-900">₹{Number(catPrice.price).toFixed(0)}</span> : <span className="text-blue-400 text-[10px]">default</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div>
          <label htmlFor="billingFrequency" className="block text-sm font-medium text-gray-700 mb-1">Billing Frequency</label>
          <select id="billingFrequency" value={form.billingFrequency} onChange={(e) => setForm({ ...form, billingFrequency: e.target.value })} className={fieldClass('billingFrequency')}>
            <option value="daily">Daily</option>
            <option value="every_2_days">Every 2 Days</option>
            <option value="weekly">Weekly</option>
            <option value="every_10_days">Every 10 Days</option>
            <option value="monthly">Monthly</option>
          </select>
          {errors.billingFrequency && <p className="text-xs text-red-600 mt-1">{errors.billingFrequency}</p>}
        </div>

        <div>
          <label htmlFor="deliveryNotes" className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes</label>
          <textarea id="deliveryNotes" value={form.deliveryNotes} onChange={(e) => setForm({ ...form, deliveryNotes: e.target.value })} className={fieldClass('deliveryNotes')} rows={2} />
        </div>

        <div>
          <label htmlFor="preferredDeliveryWindow" className="block text-sm font-medium text-gray-700 mb-1">Preferred Delivery Window</label>
          <input id="preferredDeliveryWindow" value={form.preferredDeliveryWindow} onChange={(e) => setForm({ ...form, preferredDeliveryWindow: e.target.value })} className={fieldClass('preferredDeliveryWindow')} placeholder="e.g. 6:00 AM - 8:00 AM" />
        </div>

        <fieldset className="border border-gray-200 rounded-md p-4">
          <legend className="text-sm font-medium text-gray-700 px-1">Primary Address / GPS Pin</legend>
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">You can pin location directly even without full text address.</p>
              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Pin on Map
              </button>
            </div>
            <div>
              <label htmlFor="addressLine1" className="block text-sm text-gray-600 mb-1">Address Line 1</label>
              <input id="addressLine1" value={address.addressLine1} onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })} className={fieldClass('addressLine1')} />
            </div>
            <div>
              <label htmlFor="addressLine2" className="block text-sm text-gray-600 mb-1">Address Line 2</label>
              <input id="addressLine2" value={address.addressLine2} onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })} className={fieldClass('addressLine2')} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="city" className="block text-sm text-gray-600 mb-1">City</label>
                <input id="city" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className={fieldClass('city')} />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm text-gray-600 mb-1">State</label>
                <input id="state" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className={fieldClass('state')} />
              </div>
              <div>
                <label htmlFor="pincode" className="block text-sm text-gray-600 mb-1">Pincode</label>
                <input id="pincode" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} className={fieldClass('pincode')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="latitude" className="block text-sm text-gray-600 mb-1">Latitude</label>
                <input id="latitude" value={address.latitude} onChange={(e) => setAddress({ ...address, latitude: e.target.value })} className={fieldClass('latitude')} placeholder="e.g. 28.6139" />
              </div>
              <div>
                <label htmlFor="longitude" className="block text-sm text-gray-600 mb-1">Longitude</label>
                <input id="longitude" value={address.longitude} onChange={(e) => setAddress({ ...address, longitude: e.target.value })} className={fieldClass('longitude')} placeholder="e.g. 77.2090" />
              </div>
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate('/customers')} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>

      {showPinModal && (
        <LocationPinModal
          initial={
            address.latitude.trim() !== '' && address.longitude.trim() !== ''
              ? { lat: Number(address.latitude), lng: Number(address.longitude) }
              : undefined
          }
          onClose={() => setShowPinModal(false)}
          onSelect={(point) => {
            setAddress((current) => ({
              ...current,
              latitude: point.lat.toFixed(8),
              longitude: point.lng.toFixed(8),
              addressLine1: current.addressLine1 || 'Pinned location',
            }));
            setShowPinModal(false);
          }}
        />
      )}
    </div>
  );
}

function LocationPinModal({
  initial,
  onClose,
  onSelect,
}: {
  initial?: PinPoint;
  onClose: () => void;
  onSelect: (point: PinPoint) => void;
}) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [selected, setSelected] = useState<PinPoint | null>(initial ?? null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapElRef.current || mapRef.current) return;

        const center: [number, number] = selected ? [selected.lat, selected.lng] : [20.5937, 78.9629];
        mapRef.current = L.map(mapElRef.current).setView(center, selected ? 15 : 5);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapRef.current);

        if (selected) {
          markerRef.current = L.marker([selected.lat, selected.lng]).addTo(mapRef.current);
        }

        mapRef.current.on('click', (evt: any) => {
          const point = { lat: evt.latlng.lat, lng: evt.latlng.lng };
          setSelected(point);
          if (markerRef.current) markerRef.current.remove();
          markerRef.current = L.marker([point.lat, point.lng]).addTo(mapRef.current);
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load map');
      }
    }

    init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-lg bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Pin Customer Location</h2>
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            Close
          </button>
        </div>
        <div ref={mapElRef} className="h-[420px] w-full rounded-md border border-gray-200" />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {selected ? `Selected: ${selected.lat.toFixed(8)}, ${selected.lng.toFixed(8)}` : 'Click on map to drop a pin.'}
          </p>
          <button
            type="button"
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Use This Pin
          </button>
        </div>
      </div>
    </div>
  );
}
