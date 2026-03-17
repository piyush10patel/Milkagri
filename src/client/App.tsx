import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthProvider, useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import CustomerListPage from '@/pages/customers/CustomerListPage';
import CustomerFormPage from '@/pages/customers/CustomerFormPage';
import CustomerDetailPage from '@/pages/customers/CustomerDetailPage';
import ProductListPage from '@/pages/products/ProductListPage';
import ProductFormPage from '@/pages/products/ProductFormPage';
import SubscriptionListPage from '@/pages/subscriptions/SubscriptionListPage';
import SubscriptionFormPage from '@/pages/subscriptions/SubscriptionFormPage';
import DailyOperationsPage from '@/pages/orders/DailyOperationsPage';
import DeliveryManifestPage from '@/pages/delivery/DeliveryManifestPage';
import RouteListPage from '@/pages/routes/RouteListPage';
import RouteFormPage from '@/pages/routes/RouteFormPage';
import InvoiceListPage from '@/pages/billing/InvoiceListPage';
import InvoiceDetailPage from '@/pages/billing/InvoiceDetailPage';
import OutstandingPage from '@/pages/payments/OutstandingPage';
import PaymentFormPage from '@/pages/payments/PaymentFormPage';
import CustomerLedgerPage from '@/pages/ledger/CustomerLedgerPage';
import ReportsDashboardPage from '@/pages/reports/ReportsDashboardPage';
import ReportPage from '@/pages/reports/ReportPage';
import InventoryPage from '@/pages/inventory/InventoryPage';
import UserListPage from '@/pages/users/UserListPage';
import UserFormPage from '@/pages/users/UserFormPage';
import NotificationsPage from '@/pages/notifications/NotificationsPage';
import AuditLogPage from '@/pages/audit/AuditLogPage';
import SettingsPage from '@/pages/settings/SettingsPage';

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

export default function App() {
  const auth = useAuthProvider();

  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="customers" element={<CustomerListPage />} />
          <Route path="customers/new" element={<CustomerFormPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="customers/:id/edit" element={<CustomerFormPage />} />
          <Route path="customers/:id/ledger" element={<CustomerLedgerPage />} />
          <Route path="products" element={<ProductListPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id/edit" element={<ProductFormPage />} />
          <Route path="subscriptions" element={<SubscriptionListPage />} />
          <Route path="subscriptions/new" element={<SubscriptionFormPage />} />
          <Route path="subscriptions/:id/edit" element={<SubscriptionFormPage />} />
          <Route path="orders" element={<DailyOperationsPage />} />
          <Route path="deliveries" element={<DeliveryManifestPage />} />
          <Route path="routes" element={<RouteListPage />} />
          <Route path="routes/new" element={<RouteFormPage />} />
          <Route path="routes/:id/edit" element={<RouteFormPage />} />
          <Route path="billing" element={<InvoiceListPage />} />
          <Route path="billing/:id" element={<InvoiceDetailPage />} />
          <Route path="payments" element={<OutstandingPage />} />
          <Route path="payments/new" element={<PaymentFormPage />} />
          <Route path="payments/:id/edit" element={<PaymentFormPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="reports" element={<ReportsDashboardPage />} />
          <Route path="reports/:reportType" element={<ReportPage />} />
          <Route path="users" element={<UserListPage />} />
          <Route path="users/new" element={<UserFormPage />} />
          <Route path="users/:id/edit" element={<UserFormPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthContext.Provider>
  );
}
