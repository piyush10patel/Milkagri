import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api } from '@/lib/api';

interface NavItem {
  label: string;
  to: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', roles: ['super_admin', 'admin', 'billing_staff', 'read_only'] },
  { label: 'Customers', to: '/customers', roles: ['super_admin', 'admin'] },
  { label: 'Products', to: '/products', roles: ['super_admin', 'admin'] },
  { label: 'Subscriptions', to: '/subscriptions', roles: ['super_admin', 'admin'] },
  { label: 'Orders', to: '/orders', roles: ['super_admin', 'admin'] },
  { label: 'Deliveries', to: '/deliveries', roles: ['super_admin', 'admin', 'delivery_agent'] },
  { label: 'Routes', to: '/routes', roles: ['super_admin', 'admin'] },
  { label: 'Billing', to: '/billing', roles: ['super_admin', 'admin', 'billing_staff'] },
  { label: 'Payments', to: '/payments', roles: ['super_admin', 'admin', 'billing_staff'] },
  { label: 'Reports', to: '/reports', roles: ['super_admin', 'admin', 'billing_staff', 'read_only'] },
  { label: 'Users', to: '/users', roles: ['super_admin'] },
  { label: 'Notifications', to: '/notifications', roles: ['super_admin', 'admin', 'delivery_agent', 'billing_staff', 'read_only'] },
  { label: 'Audit Log', to: '/audit-logs', roles: ['super_admin', 'admin'] },
  { label: 'Settings', to: '/settings', roles: ['super_admin'] },
];

function getVisibleItems(role: string): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

function RoleBadge({ role }: { role: string }) {
  const label = role.replace(/_/g, ' ');
  return (
    <span className="inline-block rounded-full bg-blue-100 text-blue-800 text-xs px-2 py-0.5 capitalize">
      {label}
    </span>
  );
}

function NotificationBell() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ data: Array<{ id: string }>; pagination: { total: number } }>('/api/v1/notifications?isRead=false&limit=1'),
    refetchInterval: 30000,
  });
  const unread = data?.pagination?.total ?? 0;

  return (
    <button
      type="button"
      onClick={() => navigate('/notifications')}
      className="relative p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-red-600 text-white text-[10px] font-medium px-1">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  usePageTitle();

  if (!user) return null;

  const items = getVisibleItems(user.role);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:z-auto
        `}
      >
        <div className="h-14 flex items-center px-4 border-b border-gray-200 shrink-0">
          <span className="text-lg font-bold text-gray-900">MilkDelivery</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-2" aria-label="Main navigation">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm rounded-md mx-2 my-0.5 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              {({ isActive }) => (
                <span aria-current={isActive ? 'page' : undefined}>{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <button
            type="button"
            className="md:hidden p-2 -ml-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <RoleBadge role={user.role} />
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
