import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, ChevronDown, LogOut, Settings as SettingsIcon, User as UserIcon, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storageService';
import { cn } from '../../lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<'profile' | 'notifications' | null>(null);
  const [query, setQuery] = useState('');

  const unread = user
    ? storageService.getNotifications().filter((n) => n.userId === user.id && !n.read).length
    : 0;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-popover]')) setOpenMenu(null);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/80 backdrop-blur border-b border-border">
      <div className="h-full px-4 md:px-6 flex items-center gap-3">
        <button
          aria-label="Open menu"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md hover:bg-background"
        >
          <Menu size={20} />
        </button>

        <div className="hidden md:flex items-center flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search routes, shipments…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
        </div>

        <div className="flex-1 md:hidden" />

        <div className="relative" data-popover>
          <button
            aria-label="Notifications"
            onClick={() => setOpenMenu(openMenu === 'notifications' ? null : 'notifications')}
            className="relative p-2 rounded-md hover:bg-background text-navy"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange" aria-label={`${unread} unread`} />
            )}
          </button>
          <AnimatePresence>
            {openMenu === 'notifications' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 mt-2 w-80 bg-white border border-border rounded-lg shadow-lg overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <p className="font-semibold text-navy text-sm">Notifications</p>
                  {user && unread > 0 && (
                    <button
                      onClick={() => {
                        storageService.markAllNotificationsRead(user.id);
                        window.location.reload();
                      }}
                      className="text-xs text-teal hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {user && storageService.getNotifications().filter((n) => n.userId === user.id).slice(0, 5).map((n) => (
                    <div key={n.id} className={cn('px-4 py-3 border-b border-border last:border-0', !n.read && 'bg-teal/5')}>
                      <p className="text-sm font-semibold text-navy">{n.title}</p>
                      <p className="text-xs text-muted mt-0.5">{n.body}</p>
                    </div>
                  ))}
                  {(!user || storageService.getNotifications().filter((n) => n.userId === user.id).length === 0) && (
                    <div className="px-4 py-6 text-center text-xs text-muted">No notifications.</div>
                  )}
                </div>
                <Link
                  to="/notifications"
                  onClick={() => setOpenMenu(null)}
                  className="block text-center py-2.5 text-xs text-teal font-semibold hover:bg-background"
                >
                  View all
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative" data-popover>
          <button
            onClick={() => setOpenMenu(openMenu === 'profile' ? null : 'profile')}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-background"
            aria-haspopup="menu"
          >
            <div className="h-8 w-8 rounded-full bg-deepNavy text-white flex items-center justify-center text-xs font-semibold">
              {user ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('') : 'U'}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-navy leading-none">{user?.name}</div>
              <div className="text-[10px] text-muted mt-0.5">{prettyRole(user?.role)}</div>
            </div>
            <ChevronDown size={14} className="text-muted hidden md:block" />
          </button>
          <AnimatePresence>
            {openMenu === 'profile' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 mt-2 w-56 bg-white border border-border rounded-lg shadow-lg overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border">
                  <div className="text-sm font-semibold text-navy">{user?.name}</div>
                  <div className="text-xs text-muted truncate">{user?.email}</div>
                </div>
                <button
                  onClick={() => { setOpenMenu(null); navigate('/settings'); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-background text-navy"
                >
                  <UserIcon size={14} /> Profile
                </button>
                <button
                  onClick={() => { setOpenMenu(null); navigate('/settings'); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-background text-navy"
                >
                  <SettingsIcon size={14} /> Settings
                </button>
                <button
                  onClick={() => { setOpenMenu(null); logout(); navigate('/login'); }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm hover:bg-danger/10 text-danger border-t border-border"
                >
                  <LogOut size={14} /> Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function prettyRole(role?: string) {
  if (role === 'CARGO_OWNER') return 'Cargo Owner';
  if (role === 'TRANSPORT_OPERATOR') return 'Transport Operator';
  if (role === 'ADMIN') return 'Admin';
  return 'Member';
}