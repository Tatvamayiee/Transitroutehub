import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  hint?: string;
  accent?: 'teal' | 'orange' | 'cyan' | 'navy';
}

const ACCENTS = {
  teal: 'bg-teal/10 text-teal',
  orange: 'bg-orange/10 text-orange',
  cyan: 'bg-cyan/10 text-teal',
  navy: 'bg-deepNavy/10 text-deepNavy',
};

export function StatCard({ label, value, icon: Icon, trend, trendUp, hint, accent = 'teal' }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted font-medium">{label}</p>
          <p className="text-2xl font-semibold text-navy mt-2">{value}</p>
          {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
        </div>
        <div className={cn('h-11 w-11 rounded-md flex items-center justify-center', ACCENTS[accent])}>
          <Icon size={22} />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1.5 text-xs">
          <span className={cn('inline-flex items-center gap-1 font-semibold', trendUp ? 'text-success' : 'text-danger')}>
            {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend}
          </span>
          <span className="text-muted">vs last week</span>
        </div>
      )}
    </Card>
  );
}
