import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useModalFocusTrap } from '@/hooks/useModalFocusTrap';

interface ManifestItem {
  id: string;
  customer: { id: string; name: string; phone: string; deliveryNotes?: string };
  customerAddress?: { addressLine1: string; addressLine2?: string; city?: string };
  productVariant: { id: string; product: { name: string }; unitType: string; quantityPerUnit: number };
  quantity: number;
  actualQuantity: number;
  deliverySession: 'morning' | 'evening';
  packBreakdown?: Array<{ packSize: number | string; packCount: number }>;
  status: 'pending' | 'delivered' | 'skipped' | 'failed' | 'returned';
  adjustmentType?: 'exact' | 'over' | 'under' | null;
  adjustmentQuantity?: number;
  skipReason?: string;
  failureReason?: string;
  returnedQuantity?: number;
  deliveryNotes?: string;
  sequenceOrder: number;
}

interface ReconciliationSummary {
  totalDelivered: number;
  totalSkipped: number;
  totalFailed: number;
  totalReturned: number;
  byProduct: Array<{
    productName: string;
    unitType: string;
    delivered: number;
    skipped: number;
    failed: number;
    returned: number;
  }>;
}

const SKIP_REASONS = [
  { value: 'customer_absent', label: 'Customer absent' },
  { value: 'customer_refused', label: 'Customer refused' },
  { value: 'access_issue', label: 'Access issue' },
  { value: 'other', label: 'Other' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 border-gray-300',
  delivered: 'bg-green-100 text-green-800 border-green-300',
  skipped: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
  returned: 'bg-purple-100 text-purple-800 border-purple-300',
};

export default function DeliveryManifestPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedSession, setSelectedSession] = useState<'morning' | 'evening'>('morning');
  const [activeAction, setActiveAction] = useState<{ id: string; action: string } | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [adjustedQty, setAdjustedQty] = useState('');
  const [returnedQty, setReturnedQty] = useState('');
  const [notesTarget, setNotesTarget] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');
  const [showReconciliation, setShowReconciliation] = useState(false);

  const closeActionModal = useCallback(() => {
    setActiveAction(null);
    setSkipReason('');
    setAdjustedQty('');
    setReturnedQty('');
  }, []);
  const { modalRef: actionModalRef } = useModalFocusTrap(!!activeAction, closeActionModal);

  const closeNotesModal = useCallback(() => {
    setNotesTarget(null);
    setNotesText('');
  }, []);
  const { modalRef: notesModalRef } = useModalFocusTrap(!!notesTarget, closeNotesModal);

  const closeReconModal = useCallback(() => setShowReconciliation(false), []);
  const { modalRef: reconModalRef } = useModalFocusTrap(showReconciliation, closeReconModal);

  const { data: manifestData, isLoading } = useQuery({
    queryKey: ['delivery-manifest', date],
    queryFn: () => api.get<{ data: ManifestItem[] }>(`/api/v1/delivery/manifest?date=${date}`),
  });

  const { data: reconciliationData } = useQuery({
    queryKey: ['delivery-reconciliation', date],
    queryFn: () => api.get<ReconciliationSummary>(`/api/v1/delivery/reconciliation?date=${date}`),
    enabled: showReconciliation,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/api/v1/delivery/orders/${id}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-manifest'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-reconciliation'] });
      closeActionModal();
    },
  });

  const notesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.patch(`/api/v1/delivery/orders/${id}/notes`, { deliveryNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-manifest'] });
      closeNotesModal();
    },
  });

  function handleStatusSubmit(id: string, status: string) {
    const data: Record<string, unknown> = { status };
    if (status === 'skipped') data.skipReason = skipReason;
    if (status === 'delivered' && adjustedQty) data.actualQuantity = Number(adjustedQty);
    if (status === 'returned') data.returnedQuantity = Number(returnedQty);
    statusMutation.mutate({ id, data });
  }

  const manifest = manifestData?.data ?? [];
  const filteredManifest = manifest.filter((item) => item.deliverySession === selectedSession);
  const completedCount = filteredManifest.filter((m) => m.status !== 'pending').length;
  const progressPercent = filteredManifest.length > 0 ? Math.round((completedCount / filteredManifest.length) * 100) : 0;
  const allCompleted = filteredManifest.length > 0 && filteredManifest.every((m) => m.status !== 'pending');
  const sessionTabs: Array<{ key: 'morning' | 'evening'; label: string; count: number }> = [
    { key: 'morning', label: 'Morning', count: manifest.filter((item) => item.deliverySession === 'morning').length },
    { key: 'evening', label: 'Evening', count: manifest.filter((item) => item.deliverySession === 'evening').length },
  ];

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">My Deliveries</h1>
        {allCompleted && (
          <button
            onClick={() => setShowReconciliation(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 min-h-[44px] print:hidden"
            aria-label="View end-of-day summary"
          >
            Summary
          </button>
        )}
      </div>

      <div className="mb-4 print:hidden">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setShowReconciliation(false);
          }}
          className="w-full rounded-md border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
          aria-label="Select delivery date"
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 print:hidden">
        {sessionTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedSession(tab.key)}
            className={`rounded-lg border px-4 py-3 text-sm font-medium min-h-[48px] ${
              selectedSession === tab.key
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {filteredManifest.length > 0 && (
        <div className="mb-4 print:hidden">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="capitalize">{selectedSession}: {completedCount} of {filteredManifest.length} completed</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500 text-center py-8" aria-live="polite">Loading manifest...</p>}

      <div className="space-y-3">
        {filteredManifest.map((item, idx) => (
          <div key={item.id} className={`bg-white rounded-lg border-2 p-4 ${STATUS_COLORS[item.status] ?? 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-800 text-white text-xs font-bold">{idx + 1}</span>
                <div>
                  <p className="font-semibold text-gray-900">{item.customer.name}</p>
                  <p className="text-xs text-gray-500">{item.customer.phone}</p>
                </div>
              </div>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]?.replace('border-', 'bg-') ?? ''}`}>
                {item.status}
              </span>
            </div>

            {item.customerAddress && (
              <p className="text-sm text-gray-600 mb-2">
                {[item.customerAddress.addressLine1, item.customerAddress.addressLine2, item.customerAddress.city].filter(Boolean).join(', ')}
              </p>
            )}

            {item.customer.deliveryNotes && (
              <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mb-2">{item.customer.deliveryNotes}</p>
            )}

            <div className="bg-gray-50 rounded px-3 py-2 mb-3">
              <p className="text-sm font-medium">{item.productVariant.product.name}</p>
              <p className="text-sm text-gray-600">{item.quantity} x {item.productVariant.quantityPerUnit} {item.productVariant.unitType}</p>
              <p className="text-xs text-gray-500 capitalize">Session: {item.deliverySession}</p>
              {item.status === 'delivered' && (
                <p className="text-xs text-gray-500">
                  Delivered: {item.actualQuantity}
                  {item.adjustmentType && item.adjustmentType !== 'exact' ? ` (${item.adjustmentType} by ${item.adjustmentQuantity ?? 0})` : ''}
                </p>
              )}
              {item.packBreakdown?.length ? (
                <p className="text-xs text-gray-500">
                  Packs: {item.packBreakdown.map((pack) => `${pack.packCount} x ${Number(pack.packSize)}L`).join(', ')}
                </p>
              ) : null}
            </div>

            {item.status === 'pending' && (
              <div className="grid grid-cols-2 gap-2 print:hidden">
                <button
                  onClick={() => handleStatusSubmit(item.id, 'delivered')}
                  disabled={statusMutation.isPending}
                  className="rounded-md bg-green-600 px-3 py-3 text-sm font-medium text-white hover:bg-green-700 min-h-[48px]"
                >
                  Delivered
                </button>
                <button
                  onClick={() => setActiveAction({ id: item.id, action: 'skipped' })}
                  className="rounded-md bg-yellow-500 px-3 py-3 text-sm font-medium text-white hover:bg-yellow-600 min-h-[48px]"
                >
                  Skipped
                </button>
                <button
                  onClick={() => {
                    setAdjustedQty(String(item.quantity));
                    setActiveAction({ id: item.id, action: 'delivered' });
                  }}
                  className="rounded-md bg-blue-600 px-3 py-3 text-sm font-medium text-white hover:bg-blue-700 min-h-[48px]"
                >
                  Edit Qty
                </button>
                <button
                  onClick={() => setActiveAction({ id: item.id, action: 'returned' })}
                  className="rounded-md bg-purple-600 px-3 py-3 text-sm font-medium text-white hover:bg-purple-700 min-h-[48px]"
                >
                  Returned
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setNotesTarget(item.id);
                setNotesText(item.deliveryNotes ?? '');
              }}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 min-h-[44px] print:hidden"
            >
              {item.deliveryNotes ? 'Edit Notes' : '+ Add Notes'}
            </button>
          </div>
        ))}

        {filteredManifest.length === 0 && !isLoading && (
          <p className="text-center text-sm text-gray-500 py-8">No {selectedSession} deliveries assigned for this date</p>
        )}
      </div>

      {activeAction?.action === 'skipped' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="skip-title">
          <div ref={actionModalRef} className="bg-white rounded-t-xl sm:rounded-lg p-6 w-full sm:max-w-sm sm:mx-4 shadow-xl">
            <h2 id="skip-title" className="text-lg font-semibold text-gray-900 mb-3">Skip Reason</h2>
            <div className="space-y-2 mb-4">
              {SKIP_REASONS.map((reason) => (
                <button
                  key={reason.value}
                  onClick={() => setSkipReason(reason.value)}
                  className={`w-full text-left rounded-md border px-4 py-3 text-sm min-h-[48px] ${
                    skipReason === reason.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={closeActionModal} className="flex-1 rounded-md border border-gray-300 px-3 py-3 text-sm min-h-[48px]">Cancel</button>
              <button
                onClick={() => handleStatusSubmit(activeAction.id, 'skipped')}
                disabled={!skipReason || statusMutation.isPending}
                className="flex-1 rounded-md bg-yellow-500 px-3 py-3 text-sm text-white font-medium hover:bg-yellow-600 disabled:opacity-50 min-h-[48px]"
              >
                {statusMutation.isPending ? 'Saving...' : 'Confirm Skip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeAction?.action === 'delivered' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="adjust-title">
          <div ref={actionModalRef} className="bg-white rounded-t-xl sm:rounded-lg p-6 w-full sm:max-w-sm sm:mx-4 shadow-xl">
            <h2 id="adjust-title" className="text-lg font-semibold text-gray-900 mb-1">Adjust Delivered Quantity</h2>
            <p className="text-sm text-gray-500 mb-4">Record the actual delivered quantity. The order will be marked as exact, over, or under against the planned quantity.</p>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={adjustedQty}
              onChange={(e) => setAdjustedQty(e.target.value)}
              placeholder="Enter actual delivered quantity"
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-base min-h-[48px] mb-4"
            />
            <div className="flex gap-2">
              <button onClick={closeActionModal} className="flex-1 rounded-md border border-gray-300 px-3 py-3 text-sm min-h-[48px]">Cancel</button>
              <button
                onClick={() => handleStatusSubmit(activeAction.id, 'delivered')}
                disabled={!adjustedQty || statusMutation.isPending}
                className="flex-1 rounded-md bg-blue-600 px-3 py-3 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[48px]"
              >
                {statusMutation.isPending ? 'Saving...' : 'Save Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeAction?.action === 'returned' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="return-title">
          <div ref={actionModalRef} className="bg-white rounded-t-xl sm:rounded-lg p-6 w-full sm:max-w-sm sm:mx-4 shadow-xl">
            <h2 id="return-title" className="text-lg font-semibold text-gray-900 mb-3">Returned Quantity</h2>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={returnedQty}
              onChange={(e) => setReturnedQty(e.target.value)}
              placeholder="Enter returned quantity"
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-base min-h-[48px] mb-4"
            />
            <div className="flex gap-2">
              <button onClick={closeActionModal} className="flex-1 rounded-md border border-gray-300 px-3 py-3 text-sm min-h-[48px]">Cancel</button>
              <button
                onClick={() => handleStatusSubmit(activeAction.id, 'returned')}
                disabled={!returnedQty || statusMutation.isPending}
                className="flex-1 rounded-md bg-purple-600 px-3 py-3 text-sm text-white font-medium hover:bg-purple-700 disabled:opacity-50 min-h-[48px]"
              >
                {statusMutation.isPending ? 'Saving...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {notesTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="notes-title">
          <div ref={notesModalRef} className="bg-white rounded-t-xl sm:rounded-lg p-6 w-full sm:max-w-sm sm:mx-4 shadow-xl">
            <h2 id="notes-title" className="text-lg font-semibold text-gray-900 mb-3">Delivery Notes</h2>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Add delivery notes..."
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm min-h-[100px] mb-4"
            />
            <div className="flex gap-2">
              <button onClick={closeNotesModal} className="flex-1 rounded-md border border-gray-300 px-3 py-3 text-sm min-h-[48px]">Cancel</button>
              <button
                onClick={() => notesMutation.mutate({ id: notesTarget, notes: notesText })}
                disabled={notesMutation.isPending}
                className="flex-1 rounded-md bg-blue-600 px-3 py-3 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[48px]"
              >
                {notesMutation.isPending ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReconciliation && reconciliationData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="recon-title">
          <div ref={reconModalRef} className="bg-white rounded-t-xl sm:rounded-lg p-6 w-full sm:max-w-md sm:mx-4 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 id="recon-title" className="text-lg font-semibold text-gray-900">End-of-Day Summary</h2>
              <button onClick={closeReconModal} className="text-gray-400 hover:text-gray-600 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close summary">x</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{reconciliationData.totalDelivered}</p>
                <p className="text-xs text-green-600">Delivered</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{reconciliationData.totalSkipped}</p>
                <p className="text-xs text-yellow-600">Skipped</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{reconciliationData.totalFailed}</p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-700">{reconciliationData.totalReturned}</p>
                <p className="text-xs text-purple-600">Returned</p>
              </div>
            </div>

            {reconciliationData.byProduct?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">By Product</h3>
                <div className="space-y-2">
                  {reconciliationData.byProduct.map((product, index) => (
                    <div key={index} className="bg-gray-50 rounded p-3 text-sm">
                      <p className="font-medium">{product.productName} ({product.unitType})</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-600">
                        <span className="text-green-700">Delivered {product.delivered}</span>
                        <span className="text-yellow-700">Skipped {product.skipped}</span>
                        <span className="text-red-700">Failed {product.failed}</span>
                        <span className="text-purple-700">Returned {product.returned}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
