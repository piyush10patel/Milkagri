import React, { Suspense } from 'react';
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthProvider, useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { ToastProvider } from '@/components/ui/toast';
const LoginPage = React.lazy(() => import('@/pages/LoginPage'));
const RegisterPage = React.lazy(() => import('@/pages/RegisterPage'));
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'));
const CustomerListPage = React.lazy(() => import('@/pages/customers/CustomerListPage'));
const CustomerFormPage = React.lazy(() => import('@/pages/customers/CustomerFormPage'));
const CustomerDetailPage = React.lazy(() => import('@/pages/customers/CustomerDetailPage'));
const ProductListPage = React.lazy(() => import('@/pages/products/ProductListPage'));
const ProductFormPage = React.lazy(() => import('@/pages/products/ProductFormPage'));
const PricingPage = React.lazy(() => import('@/pages/products/PricingPage'));
const SubscriptionListPage = React.lazy(() => import('@/pages/subscriptions/SubscriptionListPage'));
const SubscriptionFormPage = React.lazy(() => import('@/pages/subscriptions/SubscriptionFormPage'));
const DailyOperationsPage = React.lazy(() => import('@/pages/orders/DailyOperationsPage'));
const OrderMilkSummaryPage = React.lazy(() => import('@/pages/orders/OrderMilkSummaryPage'));
const MilkCollectionPage = React.lazy(() => import('@/pages/milk-collections/MilkCollectionPage'));
const VillageCollectionDetailPage = React.lazy(() => import('@/pages/milk-collections/VillageCollectionDetailPage'));
const VillageCollectionsOverviewPage = React.lazy(() => import('@/pages/milk-collections/VillageCollectionsOverviewPage'));
const CollectionRoutesPage = React.lazy(() => import('@/pages/milk-collections/CollectionRoutesPage'));
const FarmerMilkReportPage = React.lazy(() => import('@/pages/milk-collections/FarmerMilkReportPage'));
const TotalCollectionsPage = React.lazy(() => import('@/pages/milk-collections/TotalCollectionsPage'));
const DeliveryManifestPage = React.lazy(() => import('@/pages/delivery/DeliveryManifestPage'));
const RouteListPage = React.lazy(() => import('@/pages/routes/RouteListPage'));
const RouteFormPage = React.lazy(() => import('@/pages/routes/RouteFormPage'));
const RouteMapPage = React.lazy(() => import('@/pages/routes/RouteMapPage'));
const LiveVehicleTrackingPage = React.lazy(() => import('@/pages/tracking/LiveVehicleTrackingPage'));
const InvoiceListPage = React.lazy(() => import('@/pages/billing/InvoiceListPage'));
const InvoiceDetailPage = React.lazy(() => import('@/pages/billing/InvoiceDetailPage'));
const OutstandingPage = React.lazy(() => import('@/pages/payments/OutstandingPage'));
const PaymentFormPage = React.lazy(() => import('@/pages/payments/PaymentFormPage'));
const PaymentHistoryPage = React.lazy(() => import('@/pages/payments/PaymentHistoryPage'));
const CustomerLedgerPage = React.lazy(() => import('@/pages/ledger/CustomerLedgerPage'));
const ReportsDashboardPage = React.lazy(() => import('@/pages/reports/ReportsDashboardPage'));
const DailyDeliveryReportPage = React.lazy(() => import('@/pages/reports/DailyDeliveryReportPage'));
const RouteDeliveryReportPage = React.lazy(() => import('@/pages/reports/RouteDeliveryReportPage'));
const OutstandingReportPage = React.lazy(() => import('@/pages/reports/OutstandingReportPage'));
const RevenueReportPage = React.lazy(() => import('@/pages/reports/RevenueReportPage'));
const ProductSalesReportPage = React.lazy(() => import('@/pages/reports/ProductSalesReportPage'));
const MissedDeliveriesReportPage = React.lazy(() => import('@/pages/reports/MissedDeliveriesReportPage'));
const SubscriptionChangesReportPage = React.lazy(() => import('@/pages/reports/SubscriptionChangesReportPage'));
const InventoryPage = React.lazy(() => import('@/pages/inventory/InventoryPage'));
const UserListPage = React.lazy(() => import('@/pages/users/UserListPage'));
const UserFormPage = React.lazy(() => import('@/pages/users/UserFormPage'));
const NotificationsPage = React.lazy(() => import('@/pages/notifications/NotificationsPage'));
const AuditLogPage = React.lazy(() => import('@/pages/audit/AuditLogPage'));
const SettingsPage = React.lazy(() => import('@/pages/settings/SettingsPage'));
const AdminCollectionOverviewPage = React.lazy(() => import('@/pages/collections/AdminCollectionOverviewPage'));
const AgentAssignmentPage = React.lazy(() => import('@/pages/collections/AgentAssignmentPage'));
const AgentRemittancePage = React.lazy(() => import('@/pages/collections/AgentRemittancePage'));
const AgentBalancesPage = React.lazy(() => import('@/pages/collections/AgentBalancesPage'));
const AgentCollectionDashboardPage = React.lazy(() => import('@/pages/collections/AgentCollectionDashboardPage'));
const AgentCollectionWorkPage = React.lazy(() => import('@/pages/collections/AgentCollectionWorkPage'));
const PermissionMatrixPage = React.lazy(() => import('@/pages/settings/PermissionMatrixPage'));
const AgentsManagementPage = React.lazy(() => import('@/pages/collections/AgentsManagementPage'));

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }
  if (user) return <Navigate to="/" replace />;
  return children;
}

function RequireRole({ role, children }: { role: string; children: React.ReactElement }) {
  const { user } = useAuth();
  if (user?.role !== role) return <Navigate to="/" replace />;
  return children;
}


declare const __BUILD_TIME__: string;

export default function App() {
  const auth = useAuthProvider();

  useEffect(() => {
    const currentBuild = __BUILD_TIME__;
    const prevBuild = localStorage.getItem('app-build');
    if (prevBuild && prevBuild !== currentBuild) {
      if ('caches' in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
      localStorage.setItem('app-build', currentBuild);
      window.location.reload();
      return;
    }
    localStorage.setItem('app-build', currentBuild);
  }, []);

  return (
    <AuthContext.Provider value={auth}>
      <ToastProvider>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>}><Routes>
        <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
        <Route path="/register" element={<RedirectIfAuth><RegisterPage /></RedirectIfAuth>} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="customers" element={<CustomerListPage />} />
          <Route path="customers/new" element={<CustomerFormPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="customers/:id/edit" element={<CustomerFormPage />} />
          <Route path="customers/:id/ledger" element={<CustomerLedgerPage />} />
          <Route path="products" element={<ProductListPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id/edit" element={<ProductFormPage />} />
          <Route path="subscriptions" element={<SubscriptionListPage />} />
          <Route path="subscriptions/new" element={<SubscriptionFormPage />} />
          <Route path="subscriptions/:id/edit" element={<SubscriptionFormPage />} />
          <Route path="orders" element={<DailyOperationsPage />} />
          <Route path="orders/summary" element={<OrderMilkSummaryPage />} />
          <Route path="milk-collections" element={<VillageCollectionsOverviewPage />} />
          <Route path="milk-collections/routes" element={<CollectionRoutesPage />} />
          <Route path="milk-collections/farmer-report" element={<FarmerMilkReportPage />} />
          <Route path="milk-collections/totals" element={<TotalCollectionsPage />} />
          <Route path="milk-collections/manage" element={<MilkCollectionPage />} />
          <Route path="milk-collections/:villageId" element={<VillageCollectionDetailPage />} />
          <Route path="deliveries" element={<DeliveryManifestPage />} />
          <Route path="routes" element={<RouteListPage />} />
          <Route path="routes/map" element={<RouteMapPage />} />
          <Route path="tracking/live-gps" element={<LiveVehicleTrackingPage />} />
          <Route path="routes/new" element={<RouteFormPage />} />
          <Route path="routes/:id/edit" element={<RouteFormPage />} />
          <Route path="billing" element={<InvoiceListPage />} />
          <Route path="billing/:id" element={<InvoiceDetailPage />} />
          <Route path="payments" element={<OutstandingPage />} />
          <Route path="payments/history" element={<PaymentHistoryPage />} />
          <Route path="payments/new" element={<PaymentFormPage />} />
          <Route path="payments/:id/edit" element={<PaymentFormPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="reports" element={<ReportsDashboardPage />} />
          <Route path="reports/daily-delivery" element={<DailyDeliveryReportPage />} />
          <Route path="reports/route-delivery" element={<RouteDeliveryReportPage />} />
          <Route path="reports/outstanding" element={<OutstandingReportPage />} />
          <Route path="reports/revenue" element={<RevenueReportPage />} />
          <Route path="reports/product-sales" element={<ProductSalesReportPage />} />
          <Route path="reports/missed-deliveries" element={<MissedDeliveriesReportPage />} />
          <Route path="reports/subscription-changes" element={<SubscriptionChangesReportPage />} />
          <Route path="users" element={<UserListPage />} />
          <Route path="users/new" element={<UserFormPage />} />
          <Route path="users/:id/edit" element={<UserFormPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/permissions" element={<RequireRole role="super_admin"><PermissionMatrixPage /></RequireRole>} />
          <Route path="collections/overview" element={<AdminCollectionOverviewPage />} />
          <Route path="collections/assignments" element={<AgentAssignmentPage />} />
          <Route path="collections/remittances" element={<AgentRemittancePage />} />
          <Route path="collections/balances" element={<AgentBalancesPage />} />
          <Route path="collections/dashboard" element={<AgentCollectionDashboardPage />} />
          <Route path="collections/my-work" element={<AgentCollectionWorkPage />} />
          <Route path="collections/agents-management" element={<AgentsManagementPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes></Suspense>
      </ToastProvider>
    </AuthContext.Provider>
  );
}
