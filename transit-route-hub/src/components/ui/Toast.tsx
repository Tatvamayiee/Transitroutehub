import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  body?: string;
}

let listeners: Array<(t: ToastItem) => void> = [];

export function toast(input: { type?: ToastType; title: string; body?: string }) {
  const item: ToastItem = {
    id: Math.random().toString(36).slice(2),
    type: input.type || 'info',
    title: input.title,
    body: input.body,
  };
  listeners.forEach((l) => l(item));
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);
  useEffect(() => {
    const handler = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== t.id)), 4200);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);
  return (
    <div className="fixed top-5 right-5 z-[60] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.25 }}
            className={cn(
              'flex items-start gap-3 p-4 pr-10 rounded-md border shadow-lg bg-white relative',
              t.type === 'success' && 'border-success/30',
              t.type === 'error' && 'border-danger/30',
              t.type === 'info' && 'border-teal/30',
            )}
            role="status"
          >
            <span
              className={cn(
                'mt-0.5',
                t.type === 'success' && 'text-success',
                t.type === 'error' && 'text-danger',
                t.type === 'info' && 'text-teal',
              )}
              aria-hidden
            >
              {t.type === 'success' && <CheckCircle2 size={20} />}
              {t.type === 'error' && <AlertCircle size={20} />}
              {t.type === 'info' && <Info size={20} />}
            </span>
            <div>
              <p className="font-semibold text-navy text-sm">{t.title}</p>
              {t.body && <p className="text-xs text-muted mt-0.5">{t.body}</p>}
            </div>
            <button
              onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
              className="absolute top-3 right-3 text-muted hover:text-navy"
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
