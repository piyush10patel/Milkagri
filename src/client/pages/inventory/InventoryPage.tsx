import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface StockLineItem {
  productVariantId: string;
  productName: string;
  variantSku: string | null;
  unitType: string;
  quantityPerUnit: number;
  openingStock: number;
  inwardStock: number;
  deliveredQuantity: number;
  wastageQuantity: number;
  closingStock: number;
  hasNegativeStock: boolean;
}

interface ReconciliationResponse {
  items: StockLineItem[];
  hasNegativeStockWarning: boolean;
}

interface ProductVariant {
  id: string;
  sku: string | null;
  unitType: string;
  quantityPerUnit: number;
  product: { name: string };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InventoryPage() {
  const [date, setDate] = useState(todayStr());
  const [report, setReport] = useState<ReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInwardForm, setShowInwardForm] = useState(false);
  const [showWastageForm, setShowWastageForm] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<ReconciliationResponse>(
        `/api/inventory/reconciliation?date=${date}`,
      );
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load reconciliation');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
        <div className="flex items-center gap-3">
          <label htmlFor="inv-date" className="text-sm text-gray-600">Date</label>
          <input
            id="inv-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm"
            aria-label="Select date"
          />
          <button
            onClick={() => setShowInwardForm(true)}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700"
          >
            Record Inward
          </button>
          <button
            onClick={() => setShowWastageForm(true)}
            className="bg-amber-600 text-white px-4 py-1.5 rounded text-sm hover:bg-amber-700"
          >
            Record Wastage
          </button>
        </div>
      </div>

      {report?.hasNegativeStockWarning && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded" role="alert">
          Warning: One or more product variants have negative closing stock.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : report && report.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm" role="table">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-gray-600">Opening</th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-gray-600">Inward</th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-gray-600">Delivered</th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-gray-600">Wastage</th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-gray-600">Closing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.items.map((item) => (
                <tr
                  key={item.productVariantId}
                  className={item.hasNegativeStock ? 'bg-red-50' : ''}
                >
                  <td className="px-4 py-2">{item.productName}</td>
                  <td className="px-4 py-2 text-gray-500">{item.variantSku ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{item.openingStock}</td>
                  <td className="px-4 py-2 text-right">{item.inwardStock}</td>
                  <td className="px-4 py-2 text-right">{item.deliveredQuantity}</td>
                  <td className="px-4 py-2 text-right">{item.wastageQuantity}</td>
                  <td className={`px-4 py-2 text-right font-medium ${item.hasNegativeStock ? 'text-red-600' : ''}`}>
                    {item.closingStock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No stock data for this date.</p>
      )}

      {showInwardForm && (
        <InwardStockModal
          date={date}
          onClose={() => { setShowInwardForm(false); fetchReport(); }}
        />
      )}
      {showWastageForm && (
        <WastageModal
          date={date}
          onClose={() => { setShowWastageForm(false); fetchReport(); }}
        />
      )}

      {/* Inward Stock History */}
      <InwardHistory date={date} />

      {/* Wastage History */}
      <WastageHistory date={date} />
    </div>
  );
}

function InwardHistory({ date }: { date: string }) {
  const [items, setItems] = useState<Array<{ id: string; productVariant: { product: { name: string }; unitType: string; quantityPerUnit: number; sku?: string | null }; quantity: number; supplierName?: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<{ items: typeof items }>(`/api/inventory/inward?date=${date}`)
      .then(res => setItems(res.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) return <p className="text-sm text-gray-400">Loading inward records...</p>;
  if (!items.length) return <section className="bg-white rounded-lg border border-gray-200 p-4"><h2 className="text-sm font-semibold text-gray-900 mb-2">Inward Stock Records</h2><p className="text-sm text-gray-500">No inward stock recorded for this date.</p></section>;

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Inward Stock Records</h2>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Product</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Qty</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Supplier</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(i => (
            <tr key={i.id}>
              <td className="px-3 py-2">{i.productVariant?.product?.name ?? '—'} {i.productVariant?.quantityPerUnit}{i.productVariant?.unitType?.charAt(0)}</td>
              <td className="px-3 py-2 text-right font-medium">{i.quantity}</td>
              <td className="px-3 py-2 text-gray-600">{i.supplierName ?? '—'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{new Date(i.createdAt).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function WastageHistory({ date }: { date: string }) {
  const [items, setItems] = useState<Array<{ id: string; productVariant: { product: { name: string }; unitType: string; quantityPerUnit: number; sku?: string | null }; quantity: number; reason?: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<{ items: typeof items }>(`/api/inventory/wastage?date=${date}`)
      .then(res => setItems(res.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) return <p className="text-sm text-gray-400">Loading wastage records...</p>;
  if (!items.length) return <section className="bg-white rounded-lg border border-gray-200 p-4"><h2 className="text-sm font-semibold text-gray-900 mb-2">Wastage Records</h2><p className="text-sm text-gray-500">No wastage recorded for this date.</p></section>;

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Wastage Records</h2>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Product</th>
            <th className="px-3 py-2 text-right font-medium text-gray-600">Qty</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Reason</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(i => (
            <tr key={i.id}>
              <td className="px-3 py-2">{i.productVariant?.product?.name ?? '—'} {i.productVariant?.quantityPerUnit}{i.productVariant?.unitType?.charAt(0)}</td>
              <td className="px-3 py-2 text-right font-medium text-red-600">{i.quantity}</td>
              <td className="px-3 py-2 text-gray-600">{i.reason ?? '—'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{new Date(i.createdAt).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function InwardStockModal({ date, onClose }: { date: string; onClose: () => void }) {
  const [productVariantId, setProductVariantId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    api.get<{ items: ProductVariant[] }>('/api/products?limit=200')
      .then((res) => {
        // Flatten variants from products response
        const allVariants: ProductVariant[] = [];
        if (Array.isArray(res.items)) {
          for (const p of res.items as any[]) {
            if (p.variants) {
              for (const v of p.variants) {
                allVariants.push({ ...v, product: { name: p.name } });
              }
            }
          }
        }
        setVariants(allVariants);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      await api.post('/api/inventory/inward', {
        productVariantId,
        quantity: parseFloat(quantity),
        stockDate: date,
        supplierName,
      });
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record inward stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Record inward stock">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Record Inward Stock</h2>
        {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="inward-variant" className="block text-sm font-medium text-gray-700 mb-1">Product Variant</label>
            <select id="inward-variant" value={productVariantId} onChange={(e) => setProductVariantId(e.target.value)} required className="w-full border rounded px-3 py-2 text-sm">
              <option value="">Select variant</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.product.name} — {v.sku ?? v.unitType}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inward-qty" className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input id="inward-qty" type="number" step="0.001" min="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="inward-supplier" className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
            <input id="inward-supplier" type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WastageModal({ date, onClose }: { date: string; onClose: () => void }) {
  const [productVariantId, setProductVariantId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    api.get<{ items: ProductVariant[] }>('/api/products?limit=200')
      .then((res) => {
        const allVariants: ProductVariant[] = [];
        if (Array.isArray(res.items)) {
          for (const p of res.items as any[]) {
            if (p.variants) {
              for (const v of p.variants) {
                allVariants.push({ ...v, product: { name: p.name } });
              }
            }
          }
        }
        setVariants(allVariants);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      await api.post('/api/inventory/wastage', {
        productVariantId,
        quantity: parseFloat(quantity),
        wastageDate: date,
        reason,
      });
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record wastage');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Record wastage">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Record Wastage / Spoilage</h2>
        {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="wastage-variant" className="block text-sm font-medium text-gray-700 mb-1">Product Variant</label>
            <select id="wastage-variant" value={productVariantId} onChange={(e) => setProductVariantId(e.target.value)} required className="w-full border rounded px-3 py-2 text-sm">
              <option value="">Select variant</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.product.name} — {v.sku ?? v.unitType}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wastage-qty" className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input id="wastage-qty" type="number" step="0.001" min="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="wastage-reason" className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea id="wastage-reason" value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="submit" disabled={submitting} className="bg-amber-600 text-white px-4 py-2 rounded text-sm hover:bg-amber-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
