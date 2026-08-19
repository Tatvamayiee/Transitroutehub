import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Truck, Package, AlertCircle, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';
import { formatRelative } from '../utils/format';
import { cn } from '../lib/utils';
import type { AppNotification } from '../types';

const ICONS = {
  match: Search,
  booking: CheckCircle2,
  shipment: Truck,
  route: Package,
  system: AlertCircle,
} as const;

export function NotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);

  function reload() {
    if (!user) return;
    setItems(storageService.getNotifications().filter((n) => n.userId === user.id));
  }
  useEffect(() => { reload(); }, [user]);

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay up to date with shipments and route matches."
        actions={
          items.some((n) => !n.read) && (
            <Button variant="secondary" onClick={() => { storageService.markAllNotificationsRead(user.id); reload(); }}>
              Mark all as read
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell size={26} />}
            title="No notifications."
            description="When you get route matches or shipment updates, they'll appear here."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <button
                key={n.id}
                onClick={() => { storageService.markNotificationRead(n.id); reload(); }}
                className={cn('w-full flex items-start gap-3 p-4 text-left hover:bg-background/60 transition', !n.read && 'bg-teal/5')}
              >
                <div className={cn('h-9 w-9 rounded-md flex items-center justify-center',
                  n.type === 'booking' ? 'bg-success/10 text-success' :
                  n.type === 'match' ? 'bg-teal/10 text-teal' :
                  n.type === 'shipment' ? 'bg-orange/10 text-orange' :
                  'bg-muted/10 text-muted')}>
                  <Icon size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-navy text-sm">{n.title}</p>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-orange" aria-label="Unread" />}
                  </div>
                  <p className="text-xs text-muted mt-0.5">{n.body}</p>
                  <p className="text-[11px] text-muted mt-1">{formatRelative(n.createdAt)}</p>
                </div>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}