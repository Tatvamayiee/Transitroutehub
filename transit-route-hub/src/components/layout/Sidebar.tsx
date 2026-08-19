import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Search,
  Package,
  Truck,
  Route as RouteIcon,
  Network,
  Gauge,
  Bell,
  Settings as SettingsIcon,
  BarChart3,
  HelpCircle,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import type { UserRole } from '../../types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const OWNER_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/optimization', label: 'AI Optimization', icon: Gauge },
  { to: '/find-space', label: 'Find Cargo Space', icon: Search },
  { to: '/post-cargo', label: 'Post Cargo', icon: Package },
  { to: '/shipments', label: 'My Shipments', icon: Truck },
  { to: '/routes', label: 'Routes', icon: Truck },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const ADMIN_NAV = [
  ...OWNER_NAV,
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const NAV_BY_ROLE: Record<UserRole, typeof OWNER_NAV> = {
  CARGO_OWNER: OWNER_NAV,
  BOOKER: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/optimization', label: 'AI Optimization', icon: Gauge },
    { to: '/find-space', label: 'Find Cargo Space', icon: Search },
    { to: '/shipments', label: 'My Bookings', icon: Truck },
    { to: '/routes', label: 'Saved Routes', icon: RouteIcon },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ],
  INTERMEDIARY: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/optimization', label: 'AI Optimization', icon: Gauge },
    { to: '/delivery-desk', label: 'Delivery Desk', icon: Truck },
    { to: '/matching-center', label: 'Matching Center', icon: Network },
    { to: '/routes', label: 'Available Capacity', icon: Truck },
    { to: '/shipments', label: 'Shipments', icon: Package },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ],
  TRANSPORT_OPERATOR: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/optimization', label: 'AI Optimization', icon: Gauge },
    { to: '/routes', label: 'My Capacity', icon: Truck },
    { to: '/routes', label: 'Routes', icon: RouteIcon },
    { to: '/matching-center', label: 'Cargo Matches', icon: Network },
    { to: '/shipments', label: 'Shipments', icon: Package },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ],
  ADMIN: ADMIN_NAV,
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const nav = NAV_BY_ROLE[user?.role ?? 'CARGO_OWNER'];

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-deepNavy/40 z-30 lg:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 lg:z-0 h-screen w-64 bg-white border-r border-border flex flex-col transition-transform',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-border">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-deepNavy text-white font-bold flex items-center justify-center text-sm">TRH</div>
            <div>
              <div className="text-navy font-semibold leading-none text-sm">Transit Route Hub</div>
              <div className="text-[10px] text-muted mt-0.5 tracking-wide uppercase">Cargo Marketplace</div>
            </div>
          </Link>
          <button
            aria-label="Close menu"
            className="lg:hidden p-1.5 rounded-md hover:bg-background"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition',
                  isActive
                    ? 'bg-teal/10 text-teal'
                    : 'text-navy hover:bg-background',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={isActive ? 'text-teal' : 'text-muted'} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-border space-y-1">
          <a className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-navy hover:bg-background cursor-pointer">
            <HelpCircle size={18} className="text-muted" />
            Help & Support
          </a>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-danger hover:bg-danger/10"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>

        {user && (
          <div className="px-4 py-3 border-t border-border flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-deepNavy text-white flex items-center justify-center text-sm font-semibold">
              {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-navy truncate">{user.name}</div>
              <div className="text-xs text-muted truncate">{prettyRole(user.role)}</div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function prettyRole(role: string) {
  if (role === 'CARGO_OWNER') return 'Cargo Owner';
  if (role === 'TRANSPORT_OPERATOR') return 'Transport Operator';
  if (role === 'ADMIN') return 'Admin';
  return role;
}