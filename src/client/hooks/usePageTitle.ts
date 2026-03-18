import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/login': 'Login',
  '/customers': 'Customers',
  '/customers/new': 'New Customer',
  '/products': 'Products',
  '/pricing': 'Pricing',
  '/products/new': 'New Product',
  '/subscriptions': 'Subscriptions',
  '/subscriptions/new': 'New Subscription',
  '/orders': 'Daily Operations',
  '/deliveries': 'Delivery Manifest',
  '/routes': 'Routes',
  '/routes/new': 'New Route',
  '/billing': 'Invoices',
  '/payments': 'Payments',
  '/payments/outstanding': 'Outstanding Payments',
  '/payments/history': 'Payment History',
  '/payments/new': 'Record Payment',
  '/reports': 'Reports',
  '/users': 'Users',
  '/users/new': 'New User',
  '/notifications': 'Notifications',
  '/audit-logs': 'Audit Log',
  '/settings': 'Settings',
};

function getTitleForPath(pathname: string): string {
  // Exact match first
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];

  // Pattern matches for dynamic routes
  if (/^\/customers\/[^/]+\/edit$/.test(pathname)) return 'Edit Customer';
  if (/^\/customers\/[^/]+$/.test(pathname)) return 'Customer Details';
  if (/^\/products\/[^/]+\/edit$/.test(pathname)) return 'Edit Product';
  if (/^\/subscriptions\/[^/]+\/edit$/.test(pathname)) return 'Edit Subscription';
  if (/^\/routes\/[^/]+\/edit$/.test(pathname)) return 'Edit Route';
  if (/^\/users\/[^/]+\/edit$/.test(pathname)) return 'Edit User';
  if (/^\/billing\/[^/]+$/.test(pathname)) return 'Invoice Details';
  if (/^\/reports\/[^/]+$/.test(pathname)) return 'Report';
  if (/^\/ledger\/[^/]+$/.test(pathname)) return 'Customer Ledger';

  return 'Milk Delivery Platform';
}

/**
 * Updates document.title based on the current route.
 */
export function usePageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const title = getTitleForPath(pathname);
    document.title = `${title} — Milk Delivery Platform`;
  }, [pathname]);
}
