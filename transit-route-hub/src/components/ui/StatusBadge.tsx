import type { ShipmentStatus } from '../../types';
import { cn } from '../../lib/utils';

const STYLES: Record<ShipmentStatus, string> = {
  Searching: 'bg-muted/15 text-muted border border-muted/20',
  Matched: 'bg-cyan/15 text-teal border border-cyan/30',
  Booked: 'bg-teal/15 text-teal border border-teal/30',
  'Pickup Scheduled': 'bg-warning/15 text-warning border border-warning/30',
  'Picked Up': 'bg-warning/20 text-warning border border-warning/30',
  'In Transit': 'bg-orange/15 text-orange border border-orange/30',
  Delivered: 'bg-success/15 text-success border border-success/30',
  Cancelled: 'bg-danger/15 text-danger border border-danger/30',
};

export function StatusBadge({ status, className }: { status: ShipmentStatus | string; className?: string }) {
  const style = (STYLES as Record<string, string>)[status] ?? 'bg-muted/10 text-muted border border-border';
  return (
    <span className={cn('trh-pill', style, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {status}
    </span>
  );
}
