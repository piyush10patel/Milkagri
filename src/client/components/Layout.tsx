import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  LayoutDashboard,
  Users,
  Package,
  Tag,
  ClipboardList,
  Milk,
  Truck,
  MapPin,
  Navigation,
  Receipt,
  CreditCard,
  BarChart3,
  Bell,
  Settings,
  Shield,
  UserCircle,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Inbox,
  DollarSign,
  BookOpen,
  ClipboardCheck,
  RefreshCw,
  UserCheck,
  Warehouse,
  FileText,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  permission?: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Customers', to: '/customers', permission: 'customers', icon: <Users className="h-4 w-4" /> },
  { label: 'Products', to: '/products', permission: 'products', icon: <Package className="h-4 w-4" /> },
  { label: 'Pricing', to: '/pricing', permission: 'pricing', icon: <Tag className="h-4 w-4" /> },
  { label: 'Subscriptions', to: '/subscriptions', permission: 'subscriptions', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Orders', to: '/orders', permission: 'orders', icon: <ClipboardCheck className="h-4 w-4" /> },
  { label: 'Milk Summary', to: '/orders/summary', permission: 'milk_summary', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Milk Collection', to: '/milk-collections', permission: 'milk_collection', icon: <Milk className="h-4 w-4" /> },
  { label: 'Collection Routes', to: '/milk-collections/routes', permission: 'milk_collection', icon: <Navigation className="h-4 w-4" /> },
  { label: 'Deliveries', to: '/deliveries', permission: 'deliveries', icon: <Truck className="h-4 w-4" /> },
  { label: 'Routes', to: '/routes', permission: 'routes', icon: <MapPin className="h-4 w-4" /> },
  { label: 'Live GPS', to: '/tracking/live-gps', permission: 'live_gps', icon: <Navigation className="h-4 w-4" /> },
  { label: 'Billing', to: '/billing', permission: 'billing', icon: <Receipt className="h-4 w-4" /> },
  { label: 'Payments', to: '/payments', permission: 'payments', icon: <CreditCard className="h-4 w-4" /> },
  { label: 'Reports', to: '/reports', permission: 'reports', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Users', to: '/users', permission: 'users', icon: <UserCircle className="h-4 w-4" /> },
  { label: 'Notifications', to: '/notifications', permission: 'notifications', icon: <Bell className="h-4 w-4" /> },
  { label: 'Inventory', to: '/inventory', permission: 'inventory', icon: <Warehouse className="h-4 w-4" /> },
  { label: 'Settings', to: '/settings', permission: 'settings', icon: <Settings className="h-4 w-4" /> },
  { label: 'Audit Log', to: '/audit-logs', permission: 'audit_logs', icon: <FileText className="h-4 w-4" /> },
];

const COLLECTION_NAV_ITEMS: NavItem[] = [
  { label: 'Agents Management', to: '/collections/agents-management', permission: 'agent_assignments', icon: <UserCheck className="h-4 w-4" /> },
  { label: 'Collection Overview', to: '/collections/overview', permission: 'collections_overview', icon: <DollarSign className="h-4 w-4" /> },
  { label: 'Agent Assignments', to: '/collections/assignments', permission: 'agent_assignments', icon: <ClipboardList className="h-4 w-4" /> },
  { label: 'Remittances', to: '/collections/remittances', permission: 'remittances', icon: <RefreshCw className="h-4 w-4" /> },
  { label: 'Agent Balances', to: '/collections/balances', permission: 'agent_balances', icon: <BookOpen className="h-4 w-4" /> },
  { label: 'My Collections', to: '/collections/dashboard', permission: 'agent_collections_dashboard', icon: <ClipboardCheck className="h-4 w-4" /> },
  { label: 'My Collection Work', to: '/collections/my-work', permission: 'milk_collection', icon: <Milk className="h-4 w-4" /> },
];

function getVisibleItems(items: NavItem[], permissions: Set<string>, isSuperAdmin: boolean) {
  return items.filter((item) => !item.permission || isSuperAdmin || permissions.has(item.permission));
}

function NotificationBell({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ data: Array<{ id: string }>; pagination: { total: number } }>('/api/v1/notifications?isRead=false&limit=1'),
    enabled,
    refetchInterval: 30000,
  });
  const unread = data?.pagination?.total ?? 0;

  return (
    <button
      type="button"
      onClick={() => navigate('/notifications')}
      className="relative rounded-lg p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-all focus:outline-none"
      aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-danger-500 text-white text-[10px] font-semibold px-1 ring-2 ring-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

function SidebarNav({ items, label }: { items: NavItem[]; label?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="py-2">
      {label && (
        <p className="px-4 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
          {label}
        </p>
      )}
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-primary-50 text-primary-700 shadow-soft'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
            )
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { permissions, isLoading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  usePageTitle();

  if (!user) return null;

  const isSuperAdmin = user.role === 'super_admin';
  const canViewNotifications = isSuperAdmin || permissions.has('notifications');
  const items = getVisibleItems(NAV_ITEMS, permissions, isSuperAdmin);
  const collectionItems = getVisibleItems(COLLECTION_NAV_ITEMS, permissions, isSuperAdmin);

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 bg-white border-r border-neutral-200 flex flex-col',
          'transform transition-all duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0 md:static md:z-auto',
          sidebarCollapsed ? 'md:w-16' : 'md:w-60',
        )}
      >
        {/* Logo */}
        <div className={cn(
          'h-14 flex items-center border-b border-neutral-100 shrink-0',
          sidebarCollapsed ? 'justify-center px-0' : 'px-4',
        )}>
          {sidebarCollapsed ? (
            <span className="text-lg font-bold text-primary-600">M</span>
          ) : (
            <span className="text-lg font-bold text-neutral-900">
              <span className="text-primary-600">Milk</span>Delivery
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin" aria-label="Main navigation">
          <SidebarNav items={items} />
          {collectionItems.length > 0 && (
            <>
              <div className="mx-4 my-1 border-t border-neutral-100" />
              <SidebarNav items={collectionItems} label="Collections" />
            </>
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="hidden md:flex items-center justify-center p-2 border-t border-neutral-100">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-all"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className={cn('flex-1 flex flex-col min-w-0 transition-all duration-300')}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-14 bg-white/80 backdrop-blur-md border-b border-neutral-200 flex items-center justify-between px-4 lg:px-6 shrink-0">
          <button
            type="button"
            className="md:hidden rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden sm:flex items-center flex-1 max-w-md ml-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 py-1.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canViewNotifications && <NotificationBell enabled={canViewNotifications} />}

            {/* User menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-neutral-100 transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-neutral-900 leading-tight">{user.name}</p>
                  <p className="text-[10px] text-neutral-500 capitalize leading-tight">{user.role.replace(/_/g, ' ')}</p>
                </div>
              </button>

              {showUserMenu && (
                <div
                  className="absolute right-0 mt-1 w-56 rounded-xl bg-white border border-neutral-200 shadow-dropdown py-1.5 animate-scale-in"
                  onMouseLeave={() => setShowUserMenu(false)}
                >
                  <div className="px-4 py-2 border-b border-neutral-100">
                    <p className="text-sm font-medium text-neutral-900">{user.name}</p>
                    <p className="text-xs text-neutral-500">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowUserMenu(false); navigate('/milk-collections/farmer-report'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Farmer Report
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


