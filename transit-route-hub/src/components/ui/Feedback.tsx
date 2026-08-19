import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn('rounded-md bg-border/60', className)}
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.4, repeat: Infinity }}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-14 w-14 rounded-full bg-teal/10 text-teal flex items-center justify-center mb-4">
        {icon}
      </div>
      <h4 className="text-base font-semibold text-navy">{title}</h4>
      <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
